const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors, resolveColor } = require("discord.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");
const getters = require("../GeneralApi/Getter.js");
const gameData = require("../Schemas/game-data");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("monster-hunter")
        .setDescription("Monster hunter commands")
        .addSubcommand(subcommand =>
            subcommand.setName('check')
                .setDescription('Choose a player to check')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of check")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const role = await getters.GetRole(guild.id, "monster-hunter");
                const isRole = (role.roleMembers[0] == interaction.user.id);

                if(isRole || admin){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                    switch(options.getSubcommand())
                        {
                            case "check":
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
        eventBus.subscribe('night', ResolveNight)
        eventBus.subscribe('evening', ResolveEvening)
        eventBus.subscribe('morning', ResolveMorning)
        eventBus.subscribe("rolesCreated", createRole);

    }
}


//Resolve Command Functions
async function HandleCheck(interaction, guild, client, options){
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: "monster-hunter"});
    const checkingPlayer = await getters.GetUser(options.getUser("target").id, guild.id);

    if(!checkingPlayer){
        gen.reply(interaction, "this player is not in the game");
        return;
    }

    if(!role){
        gen.reply(interaction, "role not existent");
        return;
    }

    if(!role.specialFunctions[0].canUse){
        gen.reply(interaction, "Can't use this ability right now");
        return;
    }

    if(checkingPlayer.dead){
        gen.reply(interaction, "This player is already dead.");
        return;
    }

    const roleRefresh = await rolesSchema.findOne({guildID: guild.id, roleName: "monster-hunter"});

    await rolesSchema.updateOne({guildID: guild.id, roleName: "monster-hunter"}, 
        {$set: {"specialFunctions.0.checking": options.getUser("target").id}}, 
    {options: {upsert: true}});

    await gen.SendToChannel(roleRefresh.channelID, "Checking", "You are going to check " + userMention(checkingPlayer._id) + " tonight", client);
    await gen.SendFeedback(guild.id, "Monster hunter", "The monster hunter is going too " + userMention(checkingPlayer._id) + "tonight", client);
    gen.noReply(interaction);
}

async function ResolveMorning([client, game]){
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "monster-hunter"});

    if(!role){
        return;
    }

    if(role.specialFunctions[0].checking == ""){
        return;
    }

    //Check if evil faction
    if(role.specialFunctions[0].found){
        const playerFaction = await gen.GetPlayersFaction(role.specialFunctions[0].checking, role.guildID);

        if(playerFaction == "werewolfs" || playerFaction == "undead"){
            await gen.SendToChannel(role.channelID, "Result", "Your target was of an evil faction and was killed.", client);
            await rolesSchema.updateOne({guildID: game._id, roleName: "monster-hunter"}, 
                {$set: {specialFunctions: [{
                    checking: "",
                    found: true,
                    canUse: false
            }]}}, 
            {options: {upsert: true}});
            return;
        }
    }
    //Check for silver angel
    else{
        const silverAngelCheck = await getters.GetRole(game._id, "silver-angel");

        if(!silverAngelCheck){
            await gen.SendToChannel(role.channelID, "Result", "There is no silver angel... This should not be... Please contact your game masters", client);
            await gen.SendFeedback(game._id, "WHERE IS THE SILVER ANGEL?", "Why does the Silver Angel role not exist??? The monster hunter is now useless...", client);

            await rolesSchema.updateOne({guildID: game._id, roleName: "monster-hunter"}, 
                {$set: {specialFunctions: [{
                    checking: "",
                    found: false,
                    canUse: false
            }]}}, 
            {options: {upsert: true}});
            return;
        }

        if(silverAngelCheck.roleMembers.includes(role.specialFunctions[0].checking)){
            await gen.SendToChannel(role.channelID, "Result", "You have found the silver angel! From now on, when you use this command and the person you check is of an evil faction they will die!", client);
            await gen.SendFeedback(game._id, "Silver Angel Found", "The monster hunter has found the silver angel!", client);

            await rolesSchema.updateOne({guildID: game._id, roleName: "monster-hunter"}, 
                {$set: {specialFunctions: [{
                    checking: "",
                    found: true,
                    canUse: false
            }]}}, 
            {options: {upsert: true}});

            return;
        }

        await gen.SendToChannel(role.channelID, "Result", "This person was not the silver angel.", client);

    }
}

//Resolve Timebased Functions
async function ResolveEvening([client, game]){
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "monster-hunter"});
    const guild = await gen.getGuild(client, game._id);

    if(!role){
        return;
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "monster-hunter"}, 
        {$set: {"specialFunctions.0.canUse": true}}, 
    {options: {upsert: true}});
}


async function ResolveNight([client, game]){

    const role = await rolesSchema.findOne({guildID: game._id, roleName: "monster-hunter"});

    if(!role){
        return;
    }

    await rolesSchema.updateOne(
        {guildID: game._id, roleName: "monster-hunter"},
        {$set: {"specialFunctions.0.canUse": false}},
        {upsert: true}
    )

    if(role.specialFunctions[0].checking == ""){
        return;
    }

    const rolePlayer = await getters.GetUser(role.roleMembers[0], game._id);

    if(rolePlayer && rolePlayer.blocked){
        if(role.specialFunctions[0].checking != ""){
            await rolesSchema.updateOne(
                {guildID: game._id, roleName: "monster-hunter"},
                {$set: {"specialFunctions.0.checking": "", checking: []}},
                {upsert: true}
            )
        }
    }
}


async function createRole([client, game]){
    await rolesSchema.updateOne({guildID: game._id, roleName: "monster-hunter"}, 
        {$set: {specialFunctions: [{
            checking: "",
            found: false,
            canUse: false
    }]}}, 
    {options: {upsert: true}});
}