const {SlashCommandBuilder, roleMention, EmbedBuilder, channelMention, userMention } = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { MessageEmbed, AttachmentBuilder, PermissionFlagsBits, Colors } = require('discord.js');
const gen = require("../generalfunctions.js")
const users = require("../Schemas/users.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const getters = require("../GeneralApi/Getter.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("silver-angel")
        .setDescription("silver angel abilities")
        .addSubcommand(subcommand =>
            subcommand.setName('protect')
                .setDescription('choose a player to protect (this can also be yourself)')
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("player to protect")
                        .setRequired(true)
                )
        ),
    async execute(interaction){
        const {member, options, guild} = interaction;
        
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            const silverAngel = await rolesSchema.findOne({guildID: guild.id, roleName: "silver-angel"});
            const isSilverAngel = silverAngel.roleMembers.includes(interaction.user.id)
 
            try{
                if(admin || isSilverAngel){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                    switch(options.getSubcommand())
                    {
                        case "protect":
                            await handleProtect(options, guild, interaction);
                            return;
                    }
                }
                else{
                    gen.reply(interaction, "You cant use this command");
                }  
            }
            finally{
                mongoose.connection.close();
            }
        })  
    },
    async startup(){
        eventBus.subscribe(onEvening, "evening");
        eventBus.subscribe(onNight, "night");
    }
}

async function handleProtect(options, guild, interaction){
    const {client} = interaction;

    const silverAngel = await rolesSchema.findOne({guildID: guild.id, roleName: "silver-angel"});
    const protectingPlayer = await getters.GetUser(options.getUser("player").id, guild.id);

    if(!silverAngel){
        gen.reply(interaction, "role not existent");
        return;
    }

    if(silverAngel.specialFunctions.length == 0){
        //create
        await rolesSchema.updateOne({guildID: guild.id, roleName: "silver-angel"}, 
            {$set: {specialFunctions: [{
                protecting: "",
                protectedLast: "",
                canUse: true
        }]}}, 
        {options: {upsert: true}});
    }
    const silverAngelRefresh = await rolesSchema.findOne({guildID: guild.id, roleName: "silver-angel"});

    if(!silverAngelRefresh.specialFunctions[0].canUse){
        gen.reply(interaction, "Can't use your ability at this time");
        return;
    }

    if(protectingPlayer.dead){
        gen.reply(interaction, "You cant protect someone who is dead");
        return;
    }

    if(silverAngelRefresh.specialFunctions[0].protectedLast == options.getUser("player").id){
        gen.reply(interaction, "you can't protect the same person 2 nights in a row");
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "silver-angel"}, 
        {$set: 
        {"specialFunctions.0.protecting": options.getUser("player").id}}, 
        {options: {upsert: true}});
    
    await gen.SendFeedback(guild.id, "Silver angel protecting", "The silver angel is protecting " + userMention(options.getUser("player").id), client, Colors.White)
    await gen.SendToChannel(silverAngelRefresh.channelID, "Protecting", "You chose to protect " + userMention(options.getUser("player").id), client, Colors.White);
}

async function onEvening([client, game]){
    await rolesSchema.updateOne({guildID: game._id, roleName: "silver-angel"}, 
        {$set: 
        {"specialFunctions.0.canUse": true}}, 
        {options: {upsert: true}});
}

async function onNight([client, game]){
    await rolesSchema.updateOne({guildID: game._id, roleName: "silver-angel"}, 
        {$set: 
        {"specialFunctions.0.canUse": false}}, 
        {options: {upsert: true}});
}