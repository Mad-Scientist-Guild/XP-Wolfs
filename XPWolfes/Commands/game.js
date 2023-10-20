const {SlashCommandBuilder, roleMention, channelMention} = require("@discordjs/builders");
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
                .addChannelOption(option => 
                    option.setName("anouncement_channel")
                        .setDescription("Channel you want anouncements to be handled in.")
                        .setRequired(true)
                )
                .addChannelOption(option => 
                    option.setName("vote_channel")
                        .setDescription("Channel you want votes to be handled in.")
                        .setRequired(true)      
                )
                .addChannelOption(option => 
                    option.setName("modderator_channel")
                        .setDescription("A channel where feedback is send.")
                        .setRequired(true)      
                )
                .addChannelOption(option => 
                    option.setName("dead_channel")
                        .setDescription("A channel where the dead can talk.")
                        .setRequired(true)      
                )
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
            subcommand.setName('times')
                .setDescription('stop the game')
                .addStringOption(option => 
                    option.setName("morning")
                        .setDescription("Type a time in format HH:MM.")
                        .setRequired(true)      
                )
                .addStringOption(option => 
                    option.setName("night")
                        .setDescription("Type a time in format HH:MM.")
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
                        case "start_game":
                            await handleStart(guild, interaction, client);
                            return;
                        case "finish_game":
                            await handleFinish(guild, interaction, client);
                            return;
                        case "times":
                            await handleTimes(guild, interaction, client, options)
                            return;
                        case "reset":
                            await RESET(guild, interaction)
                            return;
                    }
                }
                else{
                    gen.reply(interaction, "You are not allowed to run this command")
                }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    }
}//Done

async function handleCreate(options, guild, interaction){
    const {client} = interaction

    const game = await gamedata.findOne({_id: guild.id});

    if(game && game.finished){
        await gamedata.updateOne({ _id: guild.id }, { $set: { 
            started: false, 
            finished: false, 
            anouncementChannel: options.getChannel("anouncement_channel"), 
            voteChannel: options.getChannel("vote_channel"), 
            modChannel: options.getChannel("modderator_channel"),
            deadChannel: options.getChannel("dead_channel"), 
            alive: [], 
            dead: [], 
            canVote: false,
            morning: "",
            night: "",
            day: 0,
            nightKilled: []
        } }, { options: { upsert: true } });

        await gen.SendFeedback(guild.id, "GAME CREATED", "A new game has been created", client, Colors.Blue);
        await gen.SendAnouncement(interaction, "NEW GAME!", "A new game has started, You can join by typing **/game join**!!")
        await gen.noReply(interaction)
    } 
    else if(!game){
        await gamedata.create({
            _id: guild.id,
            started: false,
            finished: false,
            anouncementChannel: interaction.options.getChannel("anouncement_channel").id,
            voteChannel: interaction.options.getChannel("vote_channel").id,
            modChannel: options.getChannel("modderator_channel").id, 
            lynchTimeStart: "",
            lynchTimeEnd: "",
            canVote: false,
            alive: [],
            dead: [],
            morning: "",
            night: "",
            day: 0,
            nightKilled: []
        })
        await gen.SendToChannel(interaction.options.getChannel("anouncement_channel").id, "A new game has started, You can join by typing **/game join**!!", client)
        await gen.reply(interaction, "You have created a game!");

    } else{
        await gen.reply(interaction, "A game is already in progress.");
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
            await gen.reply(interaction, "You have joined the game!")
            await gen.SendFeedback(guild.id, "PLAYER JOINED!", `${gen.getName(interaction, interaction.user.id)} Joined the game`)
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

async function handleTimes(guild, interaction, client, options){
    const game = await gameData.findOne({_id: guild.id});

    if(!game){
        await gen.reply(interaction, "There is no game to be started, use /game create to make a new game");
        return;
    }

    await gameData.updateOne({_id: guild.id}, {$set: {morning: options.getString("morning"), night: options.getString("night")}}, {options: {upsert: true}});
    await gen.reply(interaction, "Set morning and night start times");
    await gen.SendFeedback(guild.id, "TIMES", `Morning: ${options.getString("morning")} \n Night: ${options.getString("night")}`, client)
}

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