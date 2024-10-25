const {SlashCommandBuilder, roleMention, channelMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo");
const { PermissionFlagsBits, Colors } = require("discord.js");
const gen = require("../generalfunctions.js");
const { eventBus } = require("../MISC/EventBus.js");
const getters = require("../GeneralApi/Getter.js");

//Schemas
const gameData = require("../Schemas/game-data");
const users = require("../Schemas/users");
const messageSchema = require("../Schemas/message-schema.js");
const factionSchema = require("../Schemas/faction-Schema.js");
const votesSchema = require("../Schemas/vote-schema")
const mayor = require("../Schemas/mayor-schema")
const rolesSchema = require("../Schemas/roles-schema")
const familySchema = require("../Schemas/family-schema")


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
        )
        .addSubcommand(subcommand =>
            subcommand.setName('force_remove')
                .setDescription('A way for admins to remove a player from the game (can only be used before the game starts).')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of join")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('presend_message')
                .setDescription('Presend a msg to one of the channels. makes sure it arives at a certain time')
                .addChannelOption(option => 
                    option.setName("target_channel")
                        .setDescription("channel to send to")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("time_of_day")
                        .setDescription("morning / afternoon / evening / night")
                        .setRequired(true)
                        .addChoices(
                            { name: 'morning', value: 'morning' },
                            { name: 'afternoon', value: 'afternoon' },
                            { name: 'evening', value: 'evening' },
                            { name: 'night', value: 'night'},
                        )
                )
                .addStringOption(option => 
                    option.setName("message")
                        .setDescription("The message you would like to send")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('presend_delete')
                .setDescription('Delete a presend message')
                .addStringOption(option => 
                    option.setName("message_id")
                        .setDescription("ID of the msg to delete")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('create_game')
                .setDescription('Create a new game')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('open_game')
                .setDescription('Opens the game for people to join')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('start_game')
                .setDescription('Start the game')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('finish_game')
                .setDescription('stop the game')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('get_alive_players')
                .setDescription("Gives a list of all players that are alive in the current game")
            )
        .addSubcommand(subcommand =>
            subcommand.setName("reset")
                .setDescription("WARNING: THIS IS A HARD RESET FOR ALL TABLES. ONLY USE AS LAST RESORT")
        )
        .addSubcommand(subcommand =>
            subcommand.setName('change_times')
                .setDescription('stop the game')
                .addStringOption(option => 
                    option.setName("morning")
                        .setDescription("Type a time in format HH:MM.")
                        .setRequired(true)      
                )
                .addStringOption(option => 
                    option.setName("afternoon")
                        .setDescription("Type a time in format HH:MM.")
                        .setRequired(true)      
                )
                .addStringOption(option => 
                    option.setName("evening")
                        .setDescription("Type a time in format HH:MM.")
                        .setRequired(true)      
                )
                .addStringOption(option => 
                    option.setName("night")
                        .setDescription("Type a time in format HH:MM.")
                        .setRequired(true)      
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('activate_time_event')
                .setDescription('activate a specific time event')
                .addStringOption(option => 
                    option.setName("time_of_day")
                        .setDescription("morning / afternoon / evening / night")
                        .setRequired(true)
                        .addChoices(
                            { name: 'morning', value: 'morning' },
                            { name: 'afternoon', value: 'afternoon' },
                            { name: 'evening', value: 'evening' },
                            { name: 'night', value: 'night'},
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('reset_botcommands')
                .setDescription('activate a specific time event')

        )
        .addSubcommand(subcommand =>
            subcommand.setName('force_join_all')
                .setDescription('A way for admins to add all players to the game (can only be used before the game starts).')
                .addRoleOption(option => 
                    option.setName("villager_role")
                        .setDescription("role")
                        .setRequired(true)
                )
        )
        ,
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
                            await gen.Revive(options.getUser("target").id, guild, client);
                            gen.noReply(interaction)
                            return;
                        case "force_join":
                            await handleForceJoin(options.getUser("target").id, guild, interaction, client);
                            return;
                        case "get_joined":
                            await handleGetJoined(guild, interaction, client)
                            return;
                        case "force_remove":
                            await handleForceRemove(options.getUser("target").id, guild, interaction, client);
                            return;
                        case "presend_message":
                            await presendMessage(options, guild, interaction)
                            return
                        case "presend_delete":
                            await presendMessageDelete(options, guild, interaction)
                            return
                        case "create_game":
                            await handleCreate(options, guild, interaction);
                            return;
                        case "open_game":
                            await handleOpenGame(guild, interaction)
                            return;
                        case "start_game":
                            await handleStart(guild, interaction, client);
                            return;
                        case "finish_game":
                            await handleFinish(guild, interaction, client);
                            return;
                        case "set_dead_channel":
                            await SetDeadChannel(guild, interaction, client, options)
                            return;
                        case "reset":
                            await RESET(guild, interaction)
                            return;
                        case 'change_times':
                            await changeTimes(options, guild, interaction)
                            return;
                        case 'activate_time_event':
                            await timedMessageEventActivation(options, guild, interaction, client)
                            return;
                        case 'reset_botcommands':
                            await resetBotCommands(guild, interaction, client)
                            return;
                        case 'force_join_all':
                            handleForceJoinAll(options, guild, interaction, client)
                            break;
                    }
            } 
            finally{
                //mongoose.connection.close();
            }
        })
    },
    async startup(){
        eventBus.subscribe("presend", sendPresendMessages);
    }
}

async function handleForceJoin(UserID, guild, interaction, client){
    const user = await users.findOne({_id: UserID, guildID: guild.id})
    const game = await gameData.findOne({_id: guild.id});

    if(!game){
        await gen.reply(interaction, "There is no game available to join.")
        return;
    }
    if(user && !user.dead && game.alive.includes(UserID)){
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

async function handleForceJoinAll(options, guild, interaction, client){
    const roleMembers = options.getRole("villager_role").members;
    const game = await gameData.findOne({_id: guild.id});

    roleMembers.forEach(async user => {
        const joinedUser = getters.GetUser(user.id, guild.id);

        if(!game){
            await gen.reply(interaction, "There is no game available to join.")
            return;
        }
        if(joinedUser && !joinedUser.dead && game.alive.includes(user.id)){
            gen.reply(interaction, "This player has already joined")
            return;
        }
        if(joinedUser && joinedUser.dead){
            await users.updateOne({ _id: user.id }, { $set: { "dead": false } }, { options: { upsert: true } });
            await gen.SendFeedback(guild.id, "PLAYER JOINED!", `${userMention(user.id)} Joined the game`, client)
            await gen.reply(interaction, "You have put the player into the game!")
            return;
        }
        await users.create({
            _id: user.id,
            guildID: guild.id,
            dead: false,
            voted: false
        })
        await gen.SendFeedback(guild.id, "PLAYER JOINED!", `**${userMention(user.id)}** Joined the game`, client)
    })
    await gen.reply(interaction, "All players are joined in!");
}

async function handleGetJoined(guild, interaction, client){
    try
    {
        const allEntries = await users.find({guildID: guild.id})
        let allPlayers = "";

        if(allEntries){
            await allEntries.forEach(entry => {
                allPlayers = allPlayers + `${userMention(entry._id)}\n`
            });
        }
            
        await gen.SendFeedback(guild.id, "Joined Players", allPlayers, client);
        gen.noReply(interaction)
    }
    catch{
        gen.reply(interaction, "Something went wrong")
    }
}

async function handleForceRemove(UserID, guild, interaction, client){
    const user = await users.findOne({_id: UserID, guildID: guild.id})
    const game = await gameData.findOne({_id: guild.id});

    if(!game){
        await gen.reply(interaction, "There is no game available to join.")
        return;
    }
    if(user.alive && game.alive.includes(UserID)){
        await gameData.updateOne({_id: guild.id}, {alive: {$pull: UserID}}, {options: {upsert: true}});
    }
    await gen.SendFeedback(guild.id, "PLAYER REMOVED!", `**${gen.getName(interaction, UserID)}** was removed from the game`, client)
    await gen.reply(interaction, "You have put the player into the game!")
}

async function presendMessage(options, guild, interaction){
    const {client} = interaction;

    await messageSchema.create({
        guildID: guild.id,
        time: options.getString("time_of_day"),
        channelID: options.getChannel("target_channel").id,
        message: options.getString("message")
    })

    const justSend = await messageSchema.findOne({guildID: guild.id, message: options.getString("message")});

    await gen.SendFeedback(guild.id, 
        "presend message", "sending a msg in the " + options.getString("time_of_day") + " to " + channelMention(options.getChannel("target_channel").id) + "\n"
        + "To delete this msg use /admin presend_delete " + justSend._id, client
    );
    await gen.noReply(interaction);

}

async function presendMessageDelete(options, guild, interaction){
    const {client} = interaction;

    await messageSchema.deleteOne({
        _id: options.getString("message_id")
    })

    await gen.SendFeedback(guild.id, "presend message deleted", "Succesfully deleted presend msg", client);
    await gen.noReply(interaction);

}

async function sendPresendMessages([client, game, timeOfDay])
{
    const messages = await messageSchema.find({guildID: game._id, time: timeOfDay});

    if(messages.length == 0){
        return;
    }

    await messages.forEach(async PresendMessage => {
        await gen.SendToChannel(PresendMessage.channelID, "Message", PresendMessage.message, client);
        await messageSchema.deleteOne({_id: PresendMessage._id});
    })
}

async function HandleGetCurrentVotes(interaction, guild, client){

    const votedata = await voteData.find({guildID: guild.id})

    if(votedata.length == 0){
        gen.reply(interaction, "No-one has voted yet");
        return;
    }

    let sorted;
    let response = ""

    //sort the data of voting
    if(votedata.length > 1){
        sorted = await votedata.sort((a, b) => {
            if (a.votedBy.length < b.votedBy.length) {
            return 1;
            }
            if (a.votedBy.length > b.votedBy.length) {
            return -1;
            }
            return 0;
        }
        );

        
        await sorted.forEach(async item => {
            if(item._id != "Abstained") response = response + `**${gen.getName(interaction, item._id, client)}** - ${item.votedBy.length} votes.\n`
            else{
                response = response + `**${item._id}** - ${item.votedBy.length} votes.\n`
            }
        })
    }
    else{
        response = await `**${gen.getName(interaction, votedata[0]._id)}** - ${votedata[0].votedBy.length} votes.\n`
    }


    await gen.SendFeedback(guild.id, "Current votes", response, client, Colors.Green)
    gen.noReply(interaction);
}

async function timedMessageEventActivation(options, guild, interaction, client){

    const game = await getters.GetGame(guild.id);

    if(game){
        eventBus.deploy(options.getString("time_of_day"), [client, game])

        if(options.getString("time_of_day") == "morning"){
            await gen.killNightKilled(client, game);
        }
    }

    gen.noReply(interaction);
}

async function resetBotCommands(guild, interaction, client){

    // This takes ~1 hour to update
    client.application.commands.set([]);
    // This updates immediately
    guild.commands.set([]);

    gen.reply(interaction, "Reset commands. Might take ~1 hour to go into effect");
}

///
/// GAME SPECIFIC COMMANDS
///

async function handleCreate(options, guild, interaction){
    const {client} = interaction

    const game = await gameData.findOne({_id: guild.id});

    if(game && game.started && !game.finished){
        await gen.reply(interaction, "There is still a game in progress");
        return;
    }

    await requestChannels(guild, interaction);
}//Done

async function requestChannels(guild, interaction){
    let channels = []
    //Anouncement channel
    await interaction.reply({content: "Please give the **Anouncement Channel**", fetchReply: true})
    .then(async () => {
        await interaction.channel.awaitMessages({max: 1})
			.then(async collected => {
                let channelID = await collected.first().content.toString().split("#")[1].split(">")[0]
                await channels.push(channelID)

                await interaction.followUp({content: "Please give the **Vote Channel**", fetchReply: true}).then(async() =>{
                    interaction.channel.awaitMessages({max: 1}).then(async collected => {
                        let channelID = await collected.first().content.toString().split("#")[1].split(">")[0]
                        await channels.push(channelID)

                        //Modderator Channel
                        await interaction.followUp({content: "Please give the **Modderator Channel**", fetchReply: true}).then(async () =>{
                            interaction.channel.awaitMessages({max: 1}).then(async collected => {
                                let channelID = await collected.first().content.toString().split("#")[1].split(">")[0]
                                await channels.push(channelID)

                                //Dead channel
                                await interaction.followUp({content: "Please give the **Dead Channel**", fetchReply: true}).then(async () =>{
                                    interaction.channel.awaitMessages({max: 1}).then(async collected => {
                                        let channelID = await collected.first().content.toString().split("#")[1].split(">")[0]
                                        await channels.push(channelID)
                                        await requestTimes(interaction, guild, channels)
                                    })
                                })
                            })
                        })
                    })
            })
        }
    )})
}

async function requestTimes(interaction, guild, channels){
    let times = [];
    //Morning
    await interaction.followUp({content: "Please give the morning start time in HH:MM", fetchReply: true}).then(async () =>{
        interaction.channel.awaitMessages({max: 1}).then(async collected => {
            await times.push(collected.first().content)

            //Afternoon
            await interaction.followUp({content: "Please give the afternoon start time in HH:MM", fetchReply: true}).then(async () =>{
                interaction.channel.awaitMessages({max: 1}).then(async collected => {
                    await times.push(collected.first().content)
                    
                    //Evening
                    await interaction.followUp({content: "Please give the evening start time in HH:MM", fetchReply: true}).then(async () =>{
                        interaction.channel.awaitMessages({max: 1}).then(async collected => {
                            await times.push(collected.first().content)
                            
                            //Night
                            await interaction.followUp({content: "Please give the night start time in HH:MM", fetchReply: true}).then(async () =>{
                                interaction.channel.awaitMessages({max: 1}).then(async collected => {
                                    await times.push(collected.first().content)
                                    await interaction.followUp({content: "Game creation complete"})
                                    await setupGameVars(guild, times, channels, interaction)
                                })
                            })
                        })
                    })
                })
            })
        })
    })
}

async function setupGameVars(guild, times, channels, interaction){
    const {client} = interaction
    const game = await gameData.findOne({_id: guild.id})

    if(game){
        await gameData.deleteOne({_id: guild.id})
        console.log("Game deleted");
    }

    await gameData.create({
        _id: guild.id,
        started: false,
        finished: false,
        channels: [
            {
                anouncementChannel: channels[0],
                voteChannel: channels[1],
                modChannel: channels[2],
                deadChannel: channels[3]
            }, 
        ],
        times: [
            {
                morning: times[0],
                afternoon: times[1],
                evening: times[2],
                night: times[3]
            }
        ],
        canVote: false,
        votes: [],
        alive: [],
        dead: [],
        day: 0,
        nightKilled: [],
        killedLastNight: [],
        newspaper: ""
    })

    await factionSchema.create({
        guildID: guild.id,
        factionName: "vilagers",
        factionMembers: []
    })
    await factionSchema.create({
        guildID: guild.id,
        factionName: "werewolfs",
        factionMembers: []
    })
    await factionSchema.create({
        guildID: guild.id,
        factionName: "undead",
        factionMembers: []
    })
    await factionSchema.create({
        guildID: guild.id,
        factionName: "lovers",
        factionMembers: []
    })

    await gen.SendFeedback(guild.id, "NEW GAME!", "You have created a game!, When you are ready for people to join type **/game open**", client);
}//Done

async function handleOpenGame(guild, interaction){
    const {client} = interaction
    const game = await gameData.findOne({_id: guild.id})

    if(game && !game.started){
        await gen.SendAnouncement(interaction, "NEW GAME HAS STARTED", "It's time once again. the game is going to start. You can join using the **/game join** command")
        await gen.noReply()
    }
}//Done

async function handleStart(guild, interaction, client)
{
    const game = await gameData.findOne({_id: guild.id});
    const alivePlayers = await (await users.find({guildID: guild.id, dead: false})).map(value => value._id)

    //Checks
    if(!game){
        await gen.reply(interaction, "There is no game to be started, use /game create to make a new game");
        return;
    }
    if(game.started){
        await gen.reply(interaction, "Game has already started");
        return;
    }
    //Logic

    //Add users to correct channels
    const roles = await rolesSchema.find({guildID: guild.id});
    
    await roles.forEach(async role => {
        await role.roleMembers.forEach(async player => {
            gen.addToChannel(player, await gen.getChannel(client, role.channelID))
        });
    });

    //Add users to correct channels
    const families = await familySchema.find({guildID: guild.id});
    
    await families.forEach(async family => {
        await family.familyMembers.forEach(async player => {
            gen.addToChannel(player, await gen.getChannel(client, family.familyChannel))
        });
    });

    await gameData.updateOne({_id: guild.id}, { $set: {started: true, alive: alivePlayers, day: 1}}, {options: { upsert: true } })
    await gen.noReply(interaction)
    await gen.SendFeedback(guild.id, "STARTED", "The game has started", client, Colors.Blue)
    await gen.SendAnouncement(interaction, "GAME START!", "The game has started, have fun everyone!")

}//Done

async function handleFinish(guild, interaction, client){
    const game = await gameData.findOne({_id: guild.id});

    //Checks
    if(!game){
        await gen.reply(interaction, "There is no existing game");
        return;
    } // No game
    if(!game.started){
        await gen.reply(interaction, "Game has not been started yet");
        return;
    } // Not started
    if(game.finished){
        await gen.reply(interaction, "Game was already finished");
        return;
    } // Already finished

    //Logic
    await gameData.updateOne({_id: guild.id}, { $set: {"finished": true}}, {options: { upsert: true } })
    await users.deleteMany({guildID: guild.id});
    await gen.SendFeedback(guild.id, "FINISHED", "The game has concluded", client, Colors.Blue)
    await gen.noReply(interaction)

}//Done

async function RESET(guild, interaction){
    //RESET GAMEDATA
    await gameData.deleteOne({_id: guild.id})

    //RESET MAYOR
    await mayor.deleteOne({_id: guild.id})

    //RESET ROLE
    await rolesSchema.deleteMany({guildID: guild.id})

    //RESET USERS
    await users.deleteMany({guildID: guild.id});

    //RESET VOTES
    await votesSchema.deleteMany({guildID: guild.id});

    //Reset faction
    await factionSchema.deleteMany({guildID: guild.id});

    gen.reply(interaction, "GAME HAS BEEN RESET!")
}//Done

async function changeTimes(options, guild, interaction){
    const {client} = interaction

    await gameData.updateOne({_id: guild.id}, 
        {$set: {
            "times.0.morning": options.getString("morning"),
            "times.0.afternoon": options.getString("afternoon"),
            "times.0.evening": options.getString("evening"),
            "times.0.night": options.getString("night")
        }
    }, {upsert: true})

    await gen.SendFeedback(guild.id, "Changed times", "Changed the times of the day", client);
    gen.noReply(interaction);
}