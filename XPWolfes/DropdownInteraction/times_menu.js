const { default: mongoose } = require("mongoose");
const mongo = require("../mongo");
const serverSchema = require("../Schemas/server-schema");

module.exports = {
    data: {
        customId: 'times_menu'
    },
    async execute(interaction, client) {
        await mongo().then(async mongoose => {
            try{
                const {guild, values} = await interaction;

                await serverSchema.updateOne({ _id: guild.id }, { $pull: { "times": values[0] } }, { options: { upsert: true } });

                await interaction.reply({
                    content: `removed time ` + values[0],
                    ephemeral: true
                    })
            } 
            finally{
                mongoose.connection.close();
            }
        })
    }


}