export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // GET — return aggregated counts
    if (request.method === "GET") {
      const url = new URL(request.url);

      // Active users — recent actions (5 min) + RUM visitors (1 hour)
      if (url.searchParams.get("active") === "true") {
        try {
          const now = new Date();
          const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

          // Parallel: Analytics Engine (recent actions) + RUM (visitors last hour)
          const [aeResp, rumResp] = await Promise.all([
            fetch(
              `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${env.CF_API_TOKEN}`,
                  "Content-Type": "text/plain",
                },
                body: `SELECT SUM(1) AS total FROM sbfoodweek WHERE timestamp >= NOW() - INTERVAL '5' MINUTE AND blob1 != 'test'`,
              },
            ),
            fetch("https://api.cloudflare.com/client/v4/graphql", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.CF_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: `{
                  viewer {
                    accounts(filter: { accountTag: "${env.ACCOUNT_ID}" }) {
                      rumPageloadEventsAdaptiveGroups(
                        filter: { siteTag: "${env.RUM_SITE_TAG}", datetime_geq: "${oneHourAgo.toISOString()}", datetime_leq: "${now.toISOString()}" }
                        limit: 1
                      ) { count }
                    }
                  }
                }`,
              }),
            }),
          ]);

          var recentActions = 0;
          var visitors1h = 0;

          if (aeResp.ok) {
            const aeData = await aeResp.json();
            if (aeData.data && aeData.data[0]) {
              recentActions = Number(aeData.data[0].total) || 0;
            }
          }

          if (rumResp.ok) {
            const rumData = await rumResp.json();
            const acct = rumData.data && rumData.data.viewer && rumData.data.viewer.accounts && rumData.data.viewer.accounts[0];
            if (acct && acct.rumPageloadEventsAdaptiveGroups && acct.rumPageloadEventsAdaptiveGroups[0]) {
              visitors1h = acct.rumPageloadEventsAdaptiveGroups[0].count || 0;
            }
          }

          return new Response(JSON.stringify({ recentActions, visitors1h }), {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ recentActions: 0, visitors1h: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
          });
        }
      }

      // Admin — search query aggregates (token-protected)
      if (url.searchParams.get("admin") === "true") {
        const token = url.searchParams.get("token") || "";
        if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
          return new Response("Forbidden", { status: 403, headers: corsHeaders });
        }

        try {
          const resp = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.CF_API_TOKEN}`,
                "Content-Type": "text/plain",
              },
              body: `SELECT blob2 AS query, SUM(1) AS count FROM sbfoodweek WHERE blob1 = 'search' AND timestamp >= NOW() - INTERVAL '7' DAY GROUP BY query ORDER BY count DESC LIMIT 500`,
            },
          );

          if (!resp.ok) {
            return new Response("[]", {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const data = await resp.json();
          const results = (data.data || []).map(function (row) {
            return { query: row.query, count: Number(row.count) || 0 };
          });

          return new Response(JSON.stringify(results), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response("[]", {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // RUM proxy — fetch device/browser/OS from Cloudflare Web Analytics
      if (url.searchParams.get("rum") === "true") {
        try {
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const query = `{
            viewer {
              accounts(filter: { accountTag: "${env.ACCOUNT_ID}" }) {
                devices: rumPageloadEventsAdaptiveGroups(
                  filter: { siteTag: "${env.RUM_SITE_TAG}", datetime_geq: "${weekAgo.toISOString()}", datetime_leq: "${now.toISOString()}" }
                  limit: 50
                  orderBy: [count_DESC]
                ) { count dimensions { deviceType } }
                browsers: rumPageloadEventsAdaptiveGroups(
                  filter: { siteTag: "${env.RUM_SITE_TAG}", datetime_geq: "${weekAgo.toISOString()}", datetime_leq: "${now.toISOString()}" }
                  limit: 50
                  orderBy: [count_DESC]
                ) { count dimensions { userAgentBrowser } }
                os: rumPageloadEventsAdaptiveGroups(
                  filter: { siteTag: "${env.RUM_SITE_TAG}", datetime_geq: "${weekAgo.toISOString()}", datetime_leq: "${now.toISOString()}" }
                  limit: 50
                  orderBy: [count_DESC]
                ) { count dimensions { userAgentOS } }
              }
            }
          }`;

          const gqlResp = await fetch("https://api.cloudflare.com/client/v4/graphql", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
          });

          if (!gqlResp.ok) {
            return new Response(JSON.stringify({ devices: {}, browsers: {}, os: {} }), {
              headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=900" },
            });
          }

          const gql = await gqlResp.json();
          const acct = gql.data && gql.data.viewer && gql.data.viewer.accounts && gql.data.viewer.accounts[0];
          const result = { devices: {}, browsers: {}, os: {} };

          if (acct) {
            (acct.devices || []).forEach(function (r) {
              var key = r.dimensions.deviceType || "unknown";
              result.devices[key] = (result.devices[key] || 0) + r.count;
            });
            (acct.browsers || []).forEach(function (r) {
              var key = r.dimensions.userAgentBrowser || "unknown";
              result.browsers[key] = (result.browsers[key] || 0) + r.count;
            });
            (acct.os || []).forEach(function (r) {
              var key = r.dimensions.userAgentOS || "unknown";
              result.os[key] = (result.os[key] || 0) + r.count;
            });
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=900" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ devices: {}, browsers: {}, os: {} }), {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=900" },
          });
        }
      }

      // RUM hourly breakdown — visitor counts grouped by hour from Cloudflare Web Analytics
      if (url.searchParams.get("rum-hourly") === "true") {
        try {
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const query = `{
            viewer {
              accounts(filter: { accountTag: "${env.ACCOUNT_ID}" }) {
                rumPageloadEventsAdaptiveGroups(
                  filter: { siteTag: "${env.RUM_SITE_TAG}", datetime_geq: "${weekAgo.toISOString()}", datetime_leq: "${now.toISOString()}" }
                  limit: 500
                  orderBy: [datetimeHour_ASC]
                ) { count dimensions { datetimeHour } }
              }
            }
          }`;

          const gqlResp = await fetch("https://api.cloudflare.com/client/v4/graphql", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
          });

          if (!gqlResp.ok) {
            return new Response("{}", {
              headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
            });
          }

          const gql = await gqlResp.json();
          const acct = gql.data && gql.data.viewer && gql.data.viewer.accounts && gql.data.viewer.accounts[0];
          const result = {};

          if (acct && acct.rumPageloadEventsAdaptiveGroups) {
            acct.rumPageloadEventsAdaptiveGroups.forEach(function (r) {
              var hour = r.dimensions.datetimeHour;
              if (hour) {
                result[hour] = (result[hour] || 0) + r.count;
              }
            });
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
          });
        } catch (e) {
          return new Response("{}", {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
          });
        }
      }

      // Hourly breakdown — event counts grouped by hour
      if (url.searchParams.get("hourly") === "true") {
        try {
          const label = url.searchParams.get("label");
          const startParam = url.searchParams.get("start");
          const endParam = url.searchParams.get("end");
          // Use client-provided event dates if available, otherwise fall back to 7-day window
          const timeFilter = (startParam && endParam)
            ? `timestamp >= toDateTime('${startParam.replace(/'/g, "''")} 00:00:00') AND timestamp <= toDateTime('${endParam.replace(/'/g, "''")} 23:59:59')`
            : `timestamp >= NOW() - INTERVAL '7' DAY`;
          const sql = label
            ? `SELECT toStartOfHour(timestamp) AS hour, blob2 AS label, SUM(1) AS count
               FROM sbfoodweek
               WHERE ${timeFilter} AND blob1 != 'test' AND blob2 = '${label.replace(/'/g, "''")}'
               GROUP BY hour, label
               ORDER BY hour ASC
               LIMIT 5000`
            : `SELECT toStartOfHour(timestamp) AS hour, blob1 AS action, SUM(1) AS count
               FROM sbfoodweek
               WHERE ${timeFilter} AND blob1 != 'test'
               GROUP BY hour, action
               ORDER BY hour ASC
               LIMIT 5000`;

          const resp = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.CF_API_TOKEN}`,
                "Content-Type": "text/plain",
              },
              body: sql,
            },
          );

          if (!resp.ok) {
            return new Response("{}", {
              headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
            });
          }

          const data = await resp.json();
          const result = {};

          if (data.data) {
            data.data.forEach(function (row) {
              var hour = row.hour;
              if (!hour) return;
              if (label) {
                // label mode: just store count per hour
                result[hour] = Number(row.count) || 0;
              } else {
                if (!result[hour]) result[hour] = {};
                result[hour][row.action] = Number(row.count) || 0;
              }
            });
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
          });
        } catch (e) {
          return new Response("{}", {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
          });
        }
      }

      const upvotes = url.searchParams.get("upvotes") === "true";

      try {
        const sql = upvotes
          ? `SELECT blob2 AS name,
             SUM(IF(blob1 = 'upvote', 1, 0)) - SUM(IF(blob1 = 'un-upvote', 1, 0)) AS net
             FROM sbfoodweek
             WHERE timestamp >= toDateTime('2026-01-01 09:00:00')
               AND (blob1 = 'upvote' OR blob1 = 'un-upvote')
             GROUP BY blob2
             HAVING net > 0
             ORDER BY net DESC
             LIMIT 500`
          : `SELECT blob2 AS name, blob1 AS action, SUM(1) AS count
             FROM sbfoodweek
             WHERE timestamp >= toDateTime('2026-01-01 09:00:00')
               AND blob1 != 'test'
             GROUP BY blob2, blob1
             ORDER BY count DESC
             LIMIT 2000`;

        const resp = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              "Content-Type": "text/plain",
            },
            body: sql,
          },
        );

        if (!resp.ok) {
          return new Response("{}", {
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
          });
        }

        const data = await resp.json();
        const result = {};

        if (upvotes) {
          if (data.data) {
            data.data.forEach(function (row) {
              if (row.name) {
                var net = Number(row.net) || 0;
                if (net > 0) result[row.name] = net;
              }
            });
          }
        } else {
          if (data.data) {
            data.data.forEach(function (row) {
              if (row.name) {
                if (!result[row.name]) result[row.name] = {};
                result[row.name][row.action] = Number(row.count) || 0;
              }
            });
          }
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      } catch (e) {
        return new Response("{}", {
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        });
      }
    }

    // Event concluded — disable writes
    if (request.method === "POST") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // try {
    //   const { action, label } = await request.json();
    //   if (!action || !label) {
    //     return new Response("Missing fields", { status: 400, headers: corsHeaders });
    //   }
    //
    //   env.TRACKER.writeDataPoint({
    //     blobs: [action, label],
    //     indexes: [action],
    //   });
    //
    //   return new Response("ok", { headers: corsHeaders });
    // } catch (e) {
    //   return new Response("Bad request", { status: 400, headers: corsHeaders });
    // }
  },
};
