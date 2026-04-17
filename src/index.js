require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

// Import modules
const { withLock } = require('./utils/concurrency');
const { getActivityDetails } = require('./automation/activities');

// Export for tests if needed
const { checkPageStatus, ensureLogin } = require('./automation/session');
const { navigateUrl } = require('./automation/navigation');
const { waitForAngular } = require('./browser/stability');

const server = new Server(
  { name: "disney-cruise-automation", version: "1.7.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ 
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
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await withLock(async () => {
    try {
      if (name === "get_activity_details") {
        const result = await getActivityDetails(args.reservationId, args.slug, args.date, args.activityName);
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
  navigateUrl, 
  getActivityDetails,
  waitForAngular 
};

(async () => {
  if (require.main === module) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
})();
