const Discord = require("discord.js");

module.exports.execute = async (interaction) => {
  await interaction.channel.send({
    content: "Click a button below to manage your extension.",
    components: [{
      type: 1,
      components: [
        { type: Discord.ComponentType.Button, label: "Get an Extension", style: Discord.ButtonStyle.Success,   custom_id: "newExtension"     },
        { type: Discord.ComponentType.Button, label: "My Extension",     style: Discord.ButtonStyle.Primary,   custom_id: "getExtensionInfo" },
        { type: Discord.ComponentType.Button, label: "Reset Password",   style: Discord.ButtonStyle.Secondary, custom_id: "resetPassword"    },
      ]
    }]
  });
  await interaction.reply({ content: "Panel posted.", ephemeral: true });
};
