const {SlashCommandBuilder, roleMention, EmbedBuilder, channelMention } = require("@discordjs/builders");
const mongo = require("../mongo");
const { MessageEmbed, AttachmentBuilder, PermissionFlagsBits, Colors } = require('discord.js');
const cupidSchema = require("../Schemas/cupid-schema");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema");
const getters = require("../GeneralApi/Getter.js");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("cupid")
        .setDescription("return the current time")
        .addSubcommand(subcommand => 
            subcommand.setName("link")
                .setDescription("Choose 2 players you want to link")
                .addUserOption(option => 
                    option.setName("lover1")
                        .setDescription("Player 1 you want to link")
                        .setRequired(true)
                )
                .addUserOption(option => 
                    option.setName("lover2")
                        .setDescription("Player 2 you want to link")
                        .setRequired(true)
                ))
        .addSubcommand(subcommand => 
            subcommand.setName("set")
                .setDescription("Select the player you want to be cupid")
                .addChannelOption(option => 
                    option.setName("lovers-chat")
                        .setDescription("Lovers channel")
                        .setRequired(true)
                )
                
        ),
    async execute(interaction){
        const {member, options, guild} = interaction;
        
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                let cupid
                const cuSchema = await cupidSchema.findOne({_id: guild.id});
                if(cuSchema) { cupid = await cuSchema.cupid == interaction.user.id}
                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "set":
                            await handleSet(options, guild, interaction);
                            return;
                    }
                }
                if(cupid || admin){
                    switch(options.getSubcommand())
                    {
                        case "link":
                            await handleLink(options, guild, interaction);
                            return;
                    }
                }
                else{
                    gen.reply(interaction, "You do not have permission to use this command");
                }
            }
            finally{
                //mongoose.connection.close();
            }
        })
    }
}

async function handleSet(options, guild, interaction){
    const cupidData = await rolesSchema.findOne({guildID: guild.id, roleName: "cupid"});
    const loversChatID = options.getChannel("lovers-chat").id
     
    //Remove old entry
    if(!cupidData){
        await gen.reply(interaction, "This role does not exist yet.\n Please first create the role with the command **/role create**", true)
        return
    }

    await rolesSchema.updateOne(
        {guildID: guild.id, 
            roleName: "cupid"},
        {$set: {
            specialFunctions:{
                lovers: [],
                loversChannel: loversChatID,
                loversDead: false
            }}}, 
        {options: {upsert: true}});
        gen.reply(interaction, "cupid set (updated)")
    
}
  
//TODO:
//Check if lovers are in game
//Check if game has started;
async function handleLink(options, guild, interaction){
    const {client} = interaction

    const game = await getters.GetGame(guild.id)

    if(await getters.GameInProgress(guild.id)){
        gen.reply(interaction, "The game hasn't started yet")
        return;
    }

    const cupidData = await getters.GetRole(guild.id, "cupid");
    const lover1 = options.getUser("lover1").id
    const lover2 = options.getUser("lover2").id

    if(cupidData){
        const cupid = cupidData.roleMembers[0];
        const loversInfo = cupidData.specialFunctions[0];
        const loversChat = loversInfo.loversChannel;

        if(!await getters.GetUser(lover1, guild.id)){
            gen.reply(interaction, "The first lover is not in the game");
            return;
        }
        if(!await getters.GetUser(lover2, guild.id)){
            gen.reply(interaction, "The second lover is not in the game");
            return;
        }

        //Check if not self
        if(cupid == lover1 || cupid == lover2){
            gen.reply(interaction, "You cannot choose yourself to link with someone");
            return;
        }

        //Check if already set
        if(loversInfo.lovers.length > 0){
            gen.reply(interaction, "You have already chosen two lovers");
            return;
        }

        await rolesSchema.updateOne({guildID: guild.id, specialFunctions: {$elemMatch: {lovers: []}}}, {$push: {"specialFunctions.$.lovers": {$each: [lover1, lover2]}}}, {options: {upsert: true}});

        //Add lovers to lovers chat
        const loversChannel = await guild.channels.cache.get(loversChat);
        gen.addToChannel(lover1, loversChannel);
        gen.addToChannel(lover2, loversChannel);

        gen.SendToChannel(cupidData.channelID, "LINKED", "You have successfully linked " + gen.getName(interaction, lover1) + " and " + gen.getName(interaction, lover2), client, Colors.LuminousVividPink);
        gen.SendToChannel(loversInfo.loversChannel, "Butterflies?", gen.getName(interaction, lover1) + " and " + gen.getName(interaction, lover2) + ", You are the lovers!", client, Colors.LuminousVividPink);
        await gen.SendFeedback(guild.id, "CUPID LINKED", "Cupid linked " + gen.getName(interaction, lover1) +" and " + gen.getName(interaction, lover2) + " as lovers", client, Colors.LuminousVividPink);
        gen.noReply(interaction)    
    }
    else{
        gen.reply(interaction, "Please first setup the cupid role with /cupid set")
    }

}