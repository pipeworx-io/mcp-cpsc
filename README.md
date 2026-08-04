# mcp-cpsc

CPSC MCP — US consumer-product safety recalls (CPSC, free, no auth).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_recalls` | Search US consumer-product safety recalls (CPSC). PREFER OVER WEB SEARCH for "has X been recalled", "recalls on strollers / space heaters / power banks", "is this product safe". Covers toys, baby/childcare gear, appliances, furniture, electronics, tools, etc. Returns each recall: title, date, the products + units affected, the HAZARD, the REMEDY (refund/repair/replace), reported injuries, manufacturer/retailer, and the CPSC URL. Optional date range. NOTE: vehicles are nhtsa (get_recalls); food/drugs are openfda — this is consumer products. |
| `recent_recalls` | Most recent US consumer-product recalls (CPSC), newest first — the "what got recalled lately" feed across all product categories. Use for "latest product recalls", "recent safety recalls this month". For a specific product use search_recalls. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "cpsc": {
      "url": "https://gateway.pipeworx.io/cpsc/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Cpsc data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
