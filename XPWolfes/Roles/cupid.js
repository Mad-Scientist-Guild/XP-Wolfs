const {SlashCommandBuilder, roleMention, EmbedBuilder, channelMention } = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { MessageEmbed, AttachmentBuilder, PermissionFlagsBits, Colors } = require('discord.js');
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const getters = require("../GeneralApi/Getter.js");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");


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
        ,
    async execute(interaction){
        const {member, options, guild} = interaction;
        
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                let cupid
                const cuSchema = await rolesSchema.findOne({_id: guild.id, roleName: "cupid"});
                if(cuSchema) { cupid = await cuSchema.roleMembers.includes(interaction.user.id)}
                if(cupid || admin){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
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
    },
    async startup(){
        eventBus.subscribe("checkLover", checkLovers)
        eventBus.subscribe("rolesCreated", createRole);

    }
}

async function handleLink(options, guild, interaction){
    const {client} = interaction

    const game = await getters.GetGame(guild.id)

    //Check if game has started
    if(!game.started){
        gen.reply(interaction, "The game hasn't started yet")
        return;
    }

    const cupidData = await getters.GetRole(guild.id, "cupid");
    const lover1 = options.getUser("lover1").id
    const lover2 = options.getUser("lover2").id

    if(cupidData){
        const cupid = cupidData.roleMembers[0];
        const loversRole = await getters.GetRole(guild.id, "lovers");
    
        //Check if users are in game
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

        const cupidRefresh = await getters.GetRole(guild.id, "cupid")
        //Check if already set
        if(cupidRefresh.specialFunctions[0].lovers.length > 0){
            gen.reply(interaction, "You have already chosen two lovers");
            return;
        }

        await rolesSchema.updateOne(
            {guildID: guild.id, specialFunctions: {$elemMatch: {lovers: []}}}, 
            {$push: {"specialFunctions.$.lovers": {$each: [lover1, lover2]}}}, 
            {options: {upsert: true}});

        //Add lovers to lovers chat
        const loversChannel = await guild.channels.cache.get(loversRole.channelID);
        gen.addToChannel(lover1, loversChannel);
        gen.addToChannel(lover2, loversChannel);

        await factionSchema.updateOne({guildID: guild.id, factionName: "lovers"}, {$set: {factionMembers: [lover1, lover2]}}, {options: {upsert:true}});
        await factionSchema.updateOne({guildID: guild.id, factionMembers: {$in: [lover1]}}, {$pull: {factionMembers: lover1}}, {options: {upsert:true}});
        await factionSchema.updateOne({guildID: guild.id, factionMembers: {$in: [lover2]}}, {$pull: {factionMembers: lover2}}, {options: {upsert:true}});


        gen.SendToChannel(cupidData.channelID, "LINKED", "You have successfully linked " + gen.getName(interaction, lover1) + " and " + gen.getName(interaction, lover2), client, Colors.LuminousVividPink);
        gen.SendToChannel(loversRole.channelID, "Butterflies?", gen.getName(interaction, lover1) + " and " + gen.getName(interaction, lover2) + ", You are the lovers!", client, Colors.LuminousVividPink);
        await gen.SendFeedback(guild.id, "CUPID LINKED", "Cupid linked " + gen.getName(interaction, lover1) +" and " + gen.getName(interaction, lover2) + " as lovers", client, Colors.LuminousVividPink);
        gen.noReply(interaction)    
    }
    else{
        gen.reply(interaction, "Please first setup the cupid role with /cupid set")
    }

}

async function checkLovers([UserID, game, client])
{
    //Get data
    const cupid = await getters.GetRole(game._id, "cupid")

    if(cupid.specialFunctions.length == 0){
        return;
    }

    if(cupid.specialFunctions[0].lovers.includes(UserID)){

        const lover1 = await getters.GetUser(cupid.specialFunctions[0].lovers[0], game._id);
        const lover2 = await getters.GetUser(cupid.specialFunctions[0].lovers[1], game._id);

        //lovers already dead
        if(cupid.specialFunctions[0].loversDead){
            return;
        }

        if(UserID == lover1._id){
            await rolesSchema.updateOne({guildID: game._id, roleName: "cupid"}, {$set: {"specialFunctions.0.loversDead": true}}, {options: {upsert: true}})
            await gen.Kill(lover2._id, game._id, client)
        }
        else if(UserID == lover2._id){
            await rolesSchema.updateOne({guildID: game._id, roleName: "cupid"}, {$set: {"specialFunctions.0.loversDead": true}}, {options: {upsert: true}})
            await gen.Kill(lover1._id, game._id, client)
        }
        gen.SendFeedback(game._id, "Lover killed themselves", "Lovers both die", client)
    }
}


async function createRole([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, 
            roleName: "cupid"},
        {$set: {
            roleMembers: [],
            specialFunctions:{
                lovers: [],
                loversDead: false
            }}}, 
        {options: {upsert: true}});
}