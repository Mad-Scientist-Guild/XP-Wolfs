const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors, resolveColor } = require("discord.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");
const getters = require("../GeneralApi/Getter.js");
const gameData = require("../Schemas/game-data");

const RoleName = "ancient-wolf"

module.exports = {
    data : new SlashCommandBuilder()
        .setName("ancient-wolf")
        .setDescription("ancient wolf commands")
        .addSubcommand(subcommand =>
            subcommand.setName('turn')
                .setDescription('Choose to turn the person you are planning on killing')
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const role = await getters.GetRole(guild.id, RoleName);
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
                            case "turn":
                                await handleAncient(interaction, guild)
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
        eventBus.subscribe('morning', ancientWolfTurning)
        eventBus.subscribe("rolesCreated", createRole);

    }
}


//Resolve Command Functions
async function handleAncient(interaction, guild){
    const {client} = interaction
    const wwData = await getters.GetRole(guild.id, "werewolf")
    const ancient = await getters.GetRole(guild.id, RoleName)

    if(!ancient.specialFunctions[0].canUse){
        gen.reply(interaction, "Can't use this ability at this time");
        return;
    }

    if(ancient.specialFunctions[0].turned){
        gen.reply(interaction, "You cannot turn more than 1 person");
        return;
    }

    if(ancient.specialFunctions[0].turning){
        await rolesSchema.updateOne(
            {guildID: guild.id, roleName: RoleName}, 
            {$set: {"specialFunctions.0.turning": false}},
            {options: {upsert: true}}
        )
    
        gen.SendToChannel(wwData.channelID, "Turning", "The ancient wolf has decided not to turn the the person you are eating", client, Colors.DarkOrange)
    }
    else{
        await rolesSchema.updateOne(
            {guildID: guild.id, roleName: RoleName}, 
            {$set: {"specialFunctions.0.turning": true}},
            {options: {upsert: true}}
        )
    
        gen.SendToChannel(wwData.channelID, "Turning", "The anchient wolf has decided to turn the person you are eating tonight", client, Colors.DarkOrange)
        gen.SendFeedback(guild.id, "Werewolfs turning", "The ancient wolf is turning the werewolves kill target tonight", client, Colors.DarkOrange)
        gen.reply(interaction, "You are turning your target tonight");
    }
}


//Resolve Timebased Functions
async function ancientWolfTurning([client, game]){
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"})
    const ancient = await getters.GetRole(game._id, RoleName)

    if(!ancient || ancient.specialFunctions.length == 0){
        return;
    }

    const sortedVotes = await wwData.specialFunctions[0].votes.sort((a, b) => {
        if (a.votedBy.length < b.votedBy.length) {
          return 1;
        }
        if (a.votedBy.length > b.votedBy.length) {
          return -1;
        }
        return 0;
    });

    if(wwData.specialFunctions[0].turning && !wwData.specialFunctions[0].turned)
    {
        await rolesSchema.updateOne(
            {guildID: wwData._id, roleName: RoleName},
            {$set: {"specialFunctions.0.turned": true}},
            {upsert: true}
        )
        gen.addToChannel(sortedVotes[0].id, await gen.getChannel(client, wwData.channelID))
        return;
    }
}
async function ResolveEvening([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, roleName: RoleName}, 
        {$set: {"specialFunctions.0.canUse": true}},
        {options: {upsert: true}}
    )
}
async function ResolveNight([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, roleName: RoleName}, 
        {$set: {"specialFunctions.0.canUse": false}},
        {options: {upsert: true}}
    )

    const ancient = await getters.GetRole(game._id, RoleName)
    const ancientPlayer = await getters.GetUser(ancient.roleMembers[0], game._id);

    if(ancientPlayer && ancientPlayer.blocked){
        if(ancient.specialFunctions[0].turning){

            await rolesSchema.updateOne(
                {guildID: game._id, roleName: RoleName},
                {$set: {"specialFunctions.0.turning": false}},
                {upsert: true}
            )
        }
    }
}

//Create role
async function createRole([client, game]){
    await rolesSchema.updateOne({guildID: game._id, roleName: RoleName}, 
        {$set: {specialFunctions: [{
            canUse: false,
            turned: false,
            turning: false,
    }]}}, 
    {options: {upsert: true}});
}