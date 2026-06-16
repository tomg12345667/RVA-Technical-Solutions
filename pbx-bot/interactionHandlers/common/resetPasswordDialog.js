const Discord = require("discord.js");

module.exports.execute = async (interaction) => {
  await interaction.showModal({
    custom_id: "resetPasswordModal",
    title: "Reset Extension Password",
    components: [{
      type: 1,
      components: [{
        type:        Discord.ComponentType.TextInput,
        custom_id:   "newPassword",
        label:       "New Password (leave blank to auto-generate)",
        style:       Discord.TextInputStyle.Short,
        required:    false,
        placeholder: "Leave blank to generate a random password",
      }]
    }]
  });
};
