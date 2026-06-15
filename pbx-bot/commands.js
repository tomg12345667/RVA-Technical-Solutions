module.exports = [
  { name: "new",    description: "Get an extension",                 type: 1 },
  { name: "whoami", description: "View your extension info",         type: 1 },
  { name: "reset",  description: "Reset your extension password",    type: 1 },
  { name: "delete", description: "Delete your extension", type: 1,
    options: [{
      name: "confirm", description: "Type YES to confirm deletion", type: 3, required: true
    }]
  },
  { name: "button", description: "Post the extension signup panel", type: 1, default_member_permissions: "0" },
];
