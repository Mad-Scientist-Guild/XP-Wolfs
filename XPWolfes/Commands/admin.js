const {SlashCommandBuilder, roleMention} = require("@discordjs/builders");
const mongo = require("../mongo");
const { PermissionFlagsBits, Colors } = require("discord.js");
const gen = require("../generalfunctions.js");
const gameData = require("../Schemas/game-data");
const users = require("../Schemas/users");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("admin")
        .setDescription("update a specific value")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('kill')
                .setDescription('Directly kills a player')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('kill_overnight')
                .setDescription('Makes sure someone dies the next morning')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("cause")
                        .setDescription("What is the cuase of death")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('revive')
                .setDescription('Directly revives a player')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of revive")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('force_join')
                .setDescription('A way for admins to add a player to the game (can only be used before the game starts).')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of join")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('get_joined')
                .setDescription('Gets a list of everyone that has joined the game on this server')
        ),
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        if(!admin){
            gen.reply("YOU ARE NOT AN ADMINISTRATOR!!!!");
            return;
        }

        await mongo().then(async mongoose => {
            try{
                switch(options.getSubcommand())
                    {
                        case "kill":
                            await gen.Kill(options.getUser("target").id, guild.id, client, guild);
                            await gen.noReply(interaction)
                            return;
                        case "kill_overnight":
                            await gen.addToNightKilled(options.getUser("target").id, guild.id, client, options.getString("cause"));
                            await gen.SendFeedback(
                                guild.id, 
                                "KILLING OVERNIGHT", 
                                `A GM has decided to kill ${gen.getName(interaction, options.getUser("target").id, client)} overnight`, 
                                client, 
                                Colors.Default 
                                )
                            await gen.noReply(interaction)
                            return;
                        case "revive":
                            await handleRevive(options.getUser("target").id, guild, client, interaction);
                            return;
                        case "force_join":
                            await handleForceJoin(options.getUser("target").id, guild, interaction, client);
                            return;
                        case "get_joined":
                            await handleGetJoined(guild, interaction)
                            return
                    }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    }
}

async function handleRevive(UserID, guild, client, interaction){
    
    const channels = await guild.channels.cache
    for (const channel of channels.values()) 
    {
        channel.permissionOverwrites.edit(UserID, 
            {
                SendMessages: true,
            })
        }
        
    const game = await gameData.findOne({_id: guild.id})
    await users.updateOne({_id: UserID, guildID: guild.id}, {$set: {dead: false}}, {options: {upsert: true}});
    await gameData.updateOne({_id: guild.id}, {$push: {alive: UserID}}, {options: {upsert: true}})
    const deadChannel = await guild.channels.cache.get(game.deadChannel)
    deadChannel.permissionOverwrites.edit(UserID, 
        {
            SendMessages: false,
            ViewChannel: false
        })
    await gen.SendFeedback(guild.id, "REVIVED", gen.getName(null, UserID, client) + " was revived by a GM", client, Colors.Green)
    gen.noReply(interaction)


}

async function handleForceJoin(UserID, guild, interaction, client){
    const user = await users.findOne({_id: UserID, guildID: guild.id})
    const game = await gameData.findOne({_id: guild.id});

    if(!game){
        await gen.reply(interaction, "There is no game available to join.")
        return;
    }
    if(game.started)
    {
        await gen.reply(interaction, "The game has already started")
        return;
    }
    if(user && !user.dead){
        gen.reply(interaction, "This player has already joined")
        return;
    }
    if(user && user.dead){
        await users.updateOne({ _id: user }, { $set: { "dead": false } }, { options: { upsert: true } });
        await gen.SendFeedback(guild.id, "PLAYER JOINED!", `${gen.getName(interaction, UserID)} Joined the game`, client)
        await gen.reply(interaction, "You have put the player into the game!")
        return;
    }
    await users.create({
        _id: UserID,
        guildID: guild.id,
        dead: false,
        voted: false
    })
    await gen.SendFeedback(guild.id, "PLAYER JOINED!", `**${gen.getName(interaction, UserID)}** Joined the game`, client)
    await gen.reply(interaction, "You have put the player into the game!")
}

async function handleGetJoined(guild, interaction){
    try
    {
        const allEntries = await users.find({guildID: guild.id})
        allRoleNames = "**Joined Players:** \n";

        if(allEntries){
            await allEntries.forEach(entry => {
                allRoleNames = allRoleNames + `${gen.getName(interaction, entry._id)}\n`
            });
        }
            
        gen.reply(interaction, allRoleNames)
    }
    catch{
        gen.reply(interaction, "Something went wrong")
    }
}
