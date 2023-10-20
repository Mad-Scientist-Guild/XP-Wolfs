const {SlashCommandBuilder, roleMention} = require("@discordjs/builders");
const imageSchema = require("../Schemas/image-schema");
const mongo = require("../mongo");
const { PermissionFlagsBits } = require("discord.js");
const gen = require("../generalfunctions.js")

module.exports = {
    data : new SlashCommandBuilder()
        .setName("set")
        .setDescription("remove a callout or message")
        .addSubcommand(subcommand =>
            subcommand.setName('newspaper')
                .setDescription('Please send the link to the newspaper (Image)')
                .addStringOption(option => 
                    option.setName("imagelink")
                        .setDescription("ImageURL")
                        .setRequired(true)
                )
        )
        ,
    async execute(interaction){
        const {member, options, guild} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        if(!admin){
            
            gen.reply(interaction, "YOU ARE NOT AN ADMINISTRATOR!!!!");
            return;
        }

        await handleNewspaper(options, guild, interaction)
    }
}
async function handleNewspaper(options, guild, interaction) {
    let schemeData
    if(options.getSubcommand() == 'newspaper'){
        await mongo().then(async mongoose => {
            try{
                schemeData = await imageSchema.findOne({ _id: guild.id });
                if(schemeData)
                {
                    await imageSchema.updateOne({ _id: guild.id }, { $set: { "imageURL": options.getString("imagelink") } }, { options: { upsert: true } });
                    await gen.reply(interaction, `Image has been set`)
                } 
                else{
                    imageSchema.create({
                        _id: guild.id,
                        imageURL: options.getString("imagelink"),
                    })
    
                    await gen.reply( interaction, `Image has been set`)
                    }
                } 
            finally{
                mongoose.connection.close();
            }
        })
    }
}

