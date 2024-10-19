const {SlashCommandBuilder, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors } = require("discord.js");
const getters = require("../GeneralApi/Getter.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');

module.exports = {
    data : new SlashCommandBuilder()
        .setName("seer")
        .setDescription("seer commands")
        .addSubcommand(subcommand =>
            subcommand.setName('check-person')
                .setDescription('Choose a person to check their faction. If its the 2nd time checking them you will get their role')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target to check")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{

                const seer = await getters.GetRole(guild.id, "seer");
                const isSeer = (seer.roleMembers[0] == interaction.user.id);
                if(admin || isSeer){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                    
                    switch(options.getSubcommand())
                    {
                        case "check-person":
                            await HandleCheck(interaction, guild, client, options)
                            return;
                    }
                }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    },
    async startup(){
        eventBus.subscribe('morning', ResolveCheck)
        eventBus.subscribe("evening", onEvening);
        eventBus.subscribe("night", onNight);
    }
}

async function HandleCheck(interaction, guild, client, options){
    const seer = await getters.GetRole(guild.id, "seer");
    console.log("checking");

    if(!seer){
        await gen.reply(interaction, "role has note been created yet");
        return;
    }

    if(seer.specialFunctions.length == 0){
        await rolesSchema.updateOne({guildID: guild.id, roleName: "seer"}, 
            {$set: {specialFunctions: [{
                canUse: true,
                checking: "",
                checkedPrevious: []
            }]}}
        )
    }

    const seerRefresh = await getters.GetRole(guild.id, "seer");

    if(!seerRefresh.specialFunctions[0].canUse){
        await gen.reply(interaction, "Can't use your ability right now");
        return;
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "seer"}, 
        {$set: {"specialFunctions.0.checking": options.getUser("target").id}},
        {options: {upsert: true}}
    )
    
    await gen.SendToChannel(seerRefresh.channelID, "Checking", "You are going to look at " + userMention(options.getUser("target").id) + " tonight", client);
    await gen.SendFeedback(guild.id, "Seer checking", "The seer is looking at " + userMention(options.getUser("target").id) + " tonight", client);

    gen.noReply(interaction);
    
}

async function ResolveCheck([client, game])
{
    const seer = await getters.GetRole(game._id, "seer");
    if(!seer){
        return;
    }

    if(seer.specialFunctions.length == 0){
        return;
    }

    if(seer.specialFunctions[0].checking == ""){
        return;
    }

    const targetRole = await rolesSchema.findOne({guildID: game._id, roleMembers: {$in: [seer.specialFunctions[0].checking]}});
    if(seer.specialFunctions[0].checkedPrevious.includes(seer.specialFunctions[0].checking) || targetRole.roleName == "grave-robber"){
        //Return role
        gen.SendToChannel(seer.channelID, "Results", "You see that " + userMention(seer.specialFunctions[0].checking) + " is a " + targetRole.roleName, client);
        return;
    }

    //Return faction
    const faction = await gen.GetPlayersFaction(seer.specialFunctions[0].checking, game._id);
    await gen.SendToChannel(seer.channelID, "Results", "You see that " + userMention(seer.specialFunctions[0].checking) + " is part of the " + faction + " faction", client);

    await rolesSchema.updateOne({guildID: game._id, roleName: "seer"}, 
        {$set: {"specialFunctions.0.checking": ""}},
        {options: {upsert: true}}
    )
    await rolesSchema.updateOne({guildID: game._id, roleName: "seer"}, 
        {$push: {"specialFunctions.0.checkedPrevious": seer.specialFunctions[0].checking}},
        {options: {upsert: true}}
    )

}

async function onEvening([client, game]){

    const seer = await getters.GetRole(game._id, "seer");
    if(!seer){
        return;
    }

    if(seer.specialFunctions.length == 0){
        return;
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "seer"}, 
        {$set: 
        {"specialFunctions.0.canUse": true}}, 
        {options: {upsert: true}});
}

async function onNight([client, game]){

    const seer = await getters.GetRole(game._id, "seer");
    if(!seer){
        return;
    }

    if(seer.specialFunctions.length == 0){
        return;
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "seer"}, 
        {$set: 
        {"specialFunctions.0.canUse": false}}, 
        {options: {upsert: true}});
}


