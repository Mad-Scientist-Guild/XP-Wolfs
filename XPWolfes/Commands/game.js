const {SlashCommandBuilder, roleMention, channelMention, } = require("@discordjs/builders");
const rolesSchema = require("../Schemas/roles-schema")
const users = require("../Schemas/users")
const gamedata = require("../Schemas/game-data")
const mongo = require("../mongo");
const gen = require("../generalfunctions")
const cupid = require("../Schemas/cupid-schema")
const mayor = require("../Schemas/mayor-schema")
const votesSchema = require("../Schemas/vote-schema")
const wwData = require("../Schemas/ww-schema");
const {PermissionFlagsBits, Colors } = require("discord.js");
const gameData = require("../Schemas/game-data");
const brothers = require("../Schemas/brothers-schema")

module.exports = {
    data : new SlashCommandBuilder()
        .setName("game")
        .setDescription("all comands that have to do with the game")
        .addSubcommand(subcommand =>
            subcommand.setName('join')
                .setDescription('Use when you want to join')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('create')
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
            subcommand.setName('set_dead_channel')
                .setDescription('Adds dead channel')
                .addChannelOption(option => 
                    option.setName("dead_channel")
                        .setDescription("A channel where the dead can talk.")
                        .setRequired(true)      
                )
        )
        ,
    async execute(interaction){
        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        //const admin = PermissionFlagsBits.Administrator
        
        await mongo().then(async mongoose => {
            try{
                if(!admin || admin){
                    switch(options.getSubcommand())
                    {
                        case "join":
                            await handleJoin(guild, interaction, client);
                            return;
                        case "get_alive_players":
                            await GetAlivePlayers(guild, interaction)
                            return;
                    }
                }
                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "create":
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
                    }
                }
                else{
                    gen.reply(interaction, "You are not allowed to run this command")
                }
            } 
            finally{
                //mongoose.connection.close();
            }
        })
    }
}//Done


async function handleCreate(options, guild, interaction){
    const {client} = interaction

    const game = await gamedata.findOne({_id: guild.id});

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
    console.log(times)
    console.log(channels)
    const game = await gamedata.findOne({_id: guild.id})

    if(game){
        await gamedata.deleteOne({_id: guild.id})
        console.log("Game deleted");
    }
    await gamedata.create({
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
        newspaper: ""
    })

    await gen.SendFeedback(guild.id, "NEW GAME!", "You have created a game!, When you are ready for people to join type **/game open**", client);
}//Done

async function handleOpenGame(guild, interaction){
    const {client} = interaction
    const game = await gamedata.findOne({_id: guild.id})

    if(game && !game.started){
        await gen.SendAnouncement(interaction, "NEW GAME HAS STARTED", "It's time once again. the game is going to start. You can join using the **/game join** command")
        await gen.noReply()
    }
}//Done

async function handleJoin(guild, interaction, client)
{
    const user = await users.findOne({_id: interaction.user.id, guildID: guild.id})
    const game = await gamedata.findOne({_id: guild.id});

    if(game && !game.started){
        if(!user){ 
            await users.create({
                _id: interaction.user.id,
                guildID: guild.id,
                dead: false,
                voted: false
            })
            await gen.SendFeedback(guild.id, "PLAYER JOINED!", `${gen.getName(interaction, interaction.user.id)} Joined the game`, client)
            await gen.reply(interaction, "You have joined the game!")
        }
        else if(user.dead){
            await users.updateOne({ _id: user }, { $set: { "dead": false } }, { options: { upsert: true } });
            await gen.reply(interaction, "You have joined the game!")
        }
        else{
            await gen.reply(interaction, "You are already part of the game!")
        }
    }
    else if(!game){
        await gen.reply(interaction, "There is no game available to join. Please contact your GM for further information")
    } 
    else if(game.started){
        await gen.reply(interaction, "The game has already started, you can not join. Please contact the GM for further information")
    }
}//Done

async function handleStart(guild, interaction, client)
{
    const game = await gamedata.findOne({_id: guild.id});
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
    await gamedata.updateOne({_id: guild.id}, { $set: {started: true, alive: alivePlayers, day: 1}}, {options: { upsert: true } })
    await gen.noReply(interaction)
    await gen.SendFeedback(guild.id, "STARTED", "The game has started", client, Colors.Blue)
    await gen.SendAnouncement(interaction, "GAME START!", "The game has started, have fun everyone!")

}//Done

async function handleFinish(guild, interaction, client){
    const game = await gamedata.findOne({_id: guild.id});

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
    await gamedata.updateOne({_id: guild.id}, { $set: {"finished": true}}, {options: { upsert: true } })
    await users.deleteMany({guildID: guild.id});
    await gen.SendFeedback(guild.id, "FINISHED", "The game has concluded", client, Colors.Blue)
    await gen.noReply(interaction)

}//Done

async function GetAlivePlayers(guild, interaction){
    const {client} = interaction;
    const game = await gamedata.findOne({_id: guild.id});

    if(game){
        if(game.started && !game.finished){
            const alivePlayers = game.alive;
            list = "```Alive players: \n"

            await alivePlayers.forEach(async element => {
                const user = await client.users.cache.get(element);
                if(user){
                    list = list + "- "+ user.tag + "\n";
                }
            });

            list = list + "```"

            gen.reply(interaction, list);
        } else{
            gen.reply(interaction, "The game has not started yet or has already finished")
        }
    }else{
        gen.reply(interaction, "No game was found")
    }   
}//Done

async function RESET(guild, interaction){
    //RESET GAMEDATA
    await gamedata.deleteOne({_id: guild.id})

    //RESET CUPID
    await cupid.deleteOne({_id: guild.id})

    //RESET MAYOR
    await mayor.deleteOne({_id: guild.id})

    //RESET ROLE
    await rolesSchema.deleteMany({guildID: guild.id})

    //RESET USERS
    await users.deleteMany({guildID: guild.id});

    //RESET VOTES
    await votesSchema.deleteMany({guildID: guild.id});

    //RESET WEREWOLFS
    await wwData.deleteOne({_id: guild.id})

    //Delete brother
    await brothers.deleteOne({_id: guild.id})

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