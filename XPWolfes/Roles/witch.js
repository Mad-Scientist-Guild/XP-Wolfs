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
        .setName("witch")
        .setDescription("witch commands")
        .addSubcommand(subcommand =>
            subcommand.setName('kill')
                .setDescription('Choose a player to kill')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('revive')
                .setDescription('Choose a player to turn')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of revive")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const role = await getters.GetRole(guild.id, "witch");
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
                            case "kill":
                                await HandleKill(interaction, guild, client, options)
                                return;
                            case "revive":
                                await HandleRevive(interaction, guild, client, options)
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
    }
}


//Resolve Command Functions
async function HandleKill(interaction, guild, client, options){
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: "witch"});
    const killingPlayer = await getters.GetUser(options.getUser("target").id, guild.id);

    if(!killingPlayer){
        gen.reply(interaction, "this player is not in the game");
        return;
    }

    if(!role){
        gen.reply(interaction, "role not existent");
        return;
    }

    if(role.specialFunctions.length == 0){
        //create
        await createRole(guild);
    }

    const roleRefresh = await rolesSchema.findOne({guildID: guild.id, roleName: "witch"});


    if(roleRefresh.specialFunctions[0].killed){
        await gen.reply(interaction, "You have already killed someone");
    }

    if(!roleRefresh.specialFunctions[0].canKill){
        await gen.reply(interaction, "Can't use your ability right now");
        return;
    }

    if(killingPlayer.dead){
        await gen.reply(interaction, "The person you are trying to kill is already dead")
        return;
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "witch"}, 
        {$set: {"specialFunctions.0.killing": killingPlayer._id}}, 
    {options: {upsert: true}});

    await gen.SendToChannel(roleRefresh.channelID, "Killing", "You are going to kill " + userMention(killingPlayer._id) + " tonight", client, Colors.NotQuiteBlack);
    await gen.noReply(interaction);
    
}

async function HandleRevive(interaction, guild, client, options){
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: "witch"});
    const revivingPlayer = await getters.GetUser(options.getUser("target").id, guild.id);

    //Role stuff
    if(!role){
        gen.reply(interaction, "role not existent");
        return;
    }
    if(role.specialFunctions.length == 0){
        //create
        await createRole(guild);
    }

    const roleRefresh = await rolesSchema.findOne({guildID: guild.id, roleName: "witch"});

    //Check if you can revive at current time
    if(!roleRefresh.specialFunctions[0].canRevive){
        await gen.reply(interaction, "Can't use your ability right now");
        return;
    }

    //Check if already revived someone.
    if(!roleRefresh.specialFunctions[0].revived){
        await gen.reply(interaction, "You already revived someone.")
        return;
    }

    //Check for last night killed
    const game = await gameData.findOne({_id: game._id});
    if(!game.killedLastNight.includes(options.getUser("target").id)){
        await gen.reply("Can't revive this person as they did not die last night.");
        return;
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "witch"}, 
        {$set: {"specialFunctions.0.reviving": options.getUser("target").id}}, 
    {options: {upsert: true}});

    await gen.SendToChannel(roleRefresh.channelID, "Reviving", "You are going to revive " + userMention(revivingPlayer._id), client, Colors.NotQuiteBlack);
    await gen.noReply(interaction);
    
}


//Resolve Timebased Functions
async function ResolveNight([client, game]){

    const role = await rolesSchema.findOne({guildID: game._id, roleName: "witch"});

    if(!role){
        return;
    }

    if(role.specialFunctions.length == 0){
        //create
        await createRole(guild);
        return;
    }

    if(role.specialFunctions[0].killing != "" && !role.specialFunctions[0].killed){
        await gen.SendToChannel(role.channelID, "Kill", "Your target is going to die this morning", client, Colors.NotQuiteBlack);
        await gen.SendFeedback(game._id, "Witch Kill", "The witch is killing " + userMention(role.specialFunctions[0].killing) + " tonight");
        await gen.addToNightKilled(role.specialFunctions[0].killing, game._id, client, "witch");

        await rolesSchema.updateOne({guildID: game._id, roleName: "witch"}, 
            {$set: {"specialFunctions.0.killed": true}}, 
        {options: {upsert: true}});

        return;
    }
}
async function ResolveMorning([client, game])
{
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "witch"});

    if(!role){
        return;
    }

    if(role.specialFunctions.length == 0){
        //create
        await createRole(guild);
        return;
    }

    if(!role.specialFunctions[0].revived){
        await rolesSchema.updateOne({guildID: guild.id, roleName: "witch"}, 
            {$set: {"specialFunctions.0.canRevive": true}}, 
        {options: {upsert: true}});
    }
}
async function ResolveEvening([client, game]){
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "witch"});

    if(!role){
        return;
    }

    //Create role if not there yet
    if(role.specialFunctions.length == 0){
        await createRole(guild);
        return;
    }

    //Activate night ability
    if(!role.specialFunctions[0].killed){
        await rolesSchema.updateOne({guildID: guild.id, roleName: "witch"}, 
            {$set: {"specialFunctions.0.canKill": true}}, 
        {options: {upsert: true}});
    }

    //Revive someone
    if(role.specialFunctions[0].reviving != "" && !role.specialFunctions[0].revived){
        await gen.SendToChannel(role.channelID, "Revived", "Your target has been revived", client, Colors.NotQuiteBlack);
        await gen.SendFeedback(game._id, "Witch Revive", "The witch has revived " + userMention(role.specialFunctions[0].killing));
        const guild = await gen.getGuild(client, game._id)
        await gen.Revive(role.specialFunctions[0].reviving, client, guild);
        await rolesSchema.updateOne({guildID: game._id, roleName: "witch"}, 
            {$set: {"specialFunctions.0.revived": true, "specialFunctions.0.reviving": ""}}, 
        {options: {upsert: true}});

        return;
    }
}


async function createRole(guild){
    await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
        {$set: {specialFunctions: [{
            canKill: true,
            killing: "",
            killed: false,
            canRevive: false,
            reviving: "",
            revived: false,
    }]}}, 
    {options: {upsert: true}});
}