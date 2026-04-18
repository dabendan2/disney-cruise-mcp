require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

// Import modules
const { withLock } = require('./utils/concurrency');
const { getActivityDetails, getAllActivityTypes, getMyPlans, getActivityList, addActivity } = require('./automation/activities');

// Export for tests if needed
const { checkPageStatus, ensureLogin, verifySession } = require('./automation/session');
const { navigateUrl } = require('./automation/navigation');
const { waitForAngular } = require('./browser/stability');

const server = new Server(
  { name: "disney-cruise-automation", version: "1.9.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { 
      name: "get_activity_details", 
      description: "Fetch activity availability and times.", 
      inputSchema: { 
        type: "object", 
        properties: { 
          reservationId: { type: "string" }, 
          slug: { type: "string" }, 
          date: { type: "string" }, 
          activityName: { type: "string" } 
        }, 
        required: ["reservationId", "slug", "date", "activityName"] 
      } 
    },
    { 
      name: "get_all_activity_types", 
      description: "Navigate to My Plans and get all available activity categories/slugs.", 
      inputSchema: { 
        type: "object", 
        properties: { 
          reservationId: { type: "string" } 
        }, 
        required: ["reservationId"] 
      } 
    },
    { 
      name: "get_my_plans", 
      description: "Auto-detect the first available reservation from the dashboard and fetch its daily itinerary and planned activities. Returns metadata (reservationId, stateroom) plus plans.", 
      inputSchema: { 
        type: "object", 
        properties: {}
      } 
    },
    { 
      name: "get_activity_list", 
      description: "Fetch the list of activities available for a specific category and date.", 
      inputSchema: { 
        type: "object", 
        properties: { 
          reservationId: { type: "string" },
          slug: { type: "string" },
          date: { type: "string" }
        }, 
        required: ["reservationId", "slug", "date"] 
      } 
    },
    { 
      name: "add_activity", 
      description: "Add an activity to the cruise itinerary by selecting guests and a specific time slot.", 
      inputSchema: { 
        type: "object", 
        properties: { 
          reservationId: { type: "string" },
          slug: { type: "string" },
          date: { type: "string" },
          activityName: { type: "string" },
          timeSlot: { type: "string" }
        }, 
        required: ["reservationId", "slug", "date", "activityName", "timeSlot"] 
      } 
    },
    { 
      name: "ensure_login", 
      description: "Verify login session and return cookies for external use.", 
      inputSchema: { 
        type: "object", 
        properties: { 
          reservationId: { type: "string" }
        }, 
        required: ["reservationId"] 
      } 
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await withLock(async () => {
    try {
      if (name === "get_activity_details") {
        const result = await getActivityDetails(args.reservationId, args.slug, args.date, args.activityName);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      if (name === "get_all_activity_types") {
        const result = await getAllActivityTypes(args.reservationId);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      if (name === "get_my_plans") {
        const result = await getMyPlans();
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      if (name === "get_activity_list") {
        const result = await getActivityList(args.reservationId, args.slug, args.date);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      if (name === "add_activity") {
        const result = await addActivity(args.reservationId, args.slug, args.date, args.activityName, args.timeSlot);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      if (name === "ensure_login") {
        const result = await verifySession(args.reservationId);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
      throw new Error("Tool not found");
    } catch (e) { 
      return { isError: true, content: [{ type: "text", text: e.message }] }; 
    }
  });
});

module.exports = { 
  checkPageStatus, 
  ensureLogin, 
  verifySession,
  navigateUrl, 
  getActivityDetails,
  getAllActivityTypes,
  getMyPlans,
  getActivityList,
  addActivity,
  waitForAngular 
};


(async () => {
  if (require.main === module) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
})();
