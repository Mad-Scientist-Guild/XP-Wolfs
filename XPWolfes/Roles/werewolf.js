const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const gen = require("../generalfunctions.js")
const users = require("../Schemas/users.js")
const gameData = require("../Schemas/game-data.js");
const { GuildMember, PermissionFlagsBits, Colors } = require("discord.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');

module.exports = {
    data : new SlashCommandBuilder()
        .setName("werewolf")
        .setDescription("All commands revolving werewolf role")
        //Setting user to their roles
        .addSubcommand(subcommand =>
            subcommand.setName('set_werewolf_roles')
                .setDescription('Set the variables needed for the werewolfs.')
                .addUserOption(option => 
                    option.setName("ancient_wolf")
                        .setDescription("Player who will be the ancient wolf")
                )
                .addUserOption(option => 
                    option.setName("cunning_wolf")
                        .setDescription("Player who will be the cunning wolf")
                )
                .addUserOption(option => 
                    option.setName("bloodhound")
                        .setDescription("Player who will be the bloodhound")
                )
                .addUserOption(option => 
                    option.setName("mother_wolf")
                        .setDescription("Player who will be the mother wolf")
                )
                .addUserOption(option => 
                    option.setName("cub")
                        .setDescription("Player who will be the cub")
                )
        )
        //Setting channels for specific roles
        .addSubcommand(subcommand =>
            subcommand.setName('set_werewolf_role_channels')
                .setDescription('Set the variables needed for the werewolfs.')
                .addChannelOption(option =>
                    option.setName("cunning_wolf_channel")
                        .setDescription("The channel the cunning wolf will be able to vote for real in.")
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName("bloodhound_channel")
                        .setDescription("The channel the bloodhound will get their information in.")
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName("mother_and_cub_channel")
                        .setDescription("The channel the Mother and Cub can communicate in.")
                        .setRequired(true)
                )
        )
        //Vote to kill over night
        .addSubcommand(subcommand => 
            subcommand.setName('kill_vote')
                .setDescription("Please fill in the details for the role")
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("Please give the role you want to be mentioned")
                        .setRequired(true)
                    )
        )
        //Choose to use the ancient wolf power to not kill but transform
        .addSubcommand(subcommand =>
            subcommand.setName('ancient_power')
                .setDescription('Choose to turn a person')
        )
        //Mother wolf command
        .addSubcommand(subcommand =>
            subcommand.setName('motherwolf_ability')
                .setDescription('Give 2 players that the cub needs go guess')
                .addUserOption(option => 
                    option.setName("player1")
                        .setDescription("The player with the highest priority if both are guessed correctly")
                        .setRequired(true)
                )
                .addUserOption(option => 
                    option.setName("player2")
                        .setDescription("the second player the cub needs to guess")
                        .setRequired(true)
                )
        )
        //Cub commands
        .addSubcommand(subcommand =>
            subcommand.setName('cub_guess')
                .setDescription('Guess the 2 players role')
                .addStringOption(option => 
                    option.setName("guess_player1")
                        .setDescription("what is the role of the first player")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("guess_player2")
                        .setDescription("what is the role of the second player")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('cub_get_roles')
                .setDescription('get a list of all roles')
        )
        //Bloodhound command
        .addSubcommand(subcommand =>
            subcommand.setName("bloodhound_check")
                .setDescription('give 1 player to check if they left this night')
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("The player you wanna look at")
                        .setRequired(true)
                )
        )
        //Cunning Subcommand
        .addSubcommand(subcommand =>
            subcommand.setName("cunning_vote")
                .setDescription('Choose the person to fake vote for')
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("player to vote for")
                        .setRequired(true)
                )
        )
        ,
    async execute(interaction){
        const {member, options, guild} = interaction;
        const admin = member?.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const wwCheck = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"});

                const ww = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"});

                const user = await users.findOne({guildID: guild.id, _id: interaction.user.id});

                //Check if specific role
                let isCub = (interaction.user.id === await ww.specialFunctions[0].cub)
                let isCunning = (interaction.user.id === await ww.specialFunctions[0].cunningWolf)
                
                //Check if ww overall
                let isWW;
                if(ww && ww.roleMembers.length > 0) isWW = ww.roleMembers.includes(interaction.user.id);

                //Check if user is in the game
                if(!user && !admin){
                    gen.reply(interaction, "The user is not yet in the game", true)
                    return;
                }
                //Check if user trying to use command is not dead
                if(user.dead && !admin){
                    gen.reply(interaction, "You are dead and cannot use these commands", true)
                    return;
                }

                //Admin commands
                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "set_werewolf_roles":
                            await handleSetWerewolfRoles(options, guild, interaction);
                            return;
                        case "set_werewolf_role_channels":
                            await handleSetWerewolfChannels(options, guild, interaction);
                            return;
                    }
                }
                if(isWW || admin){
                //Other commands
                    switch(options.getSubcommand())
                    {
                        case "kill_vote":
                            await handleVoteNew(options, guild, interaction);
                            return;
                        case "ancient_power":
                            await handleAncient(guild, interaction)
                            return;
                        case "motherwolf_ability":
                            await handleMotherAbility(options, guild, interaction)
                            return;
                        case "bloodhound_check":
                            await handleBloodHound(options, guild, interaction)
                            return;
                    }
                }
                if(isCub || admin){
                    switch(options.getSubcommand())
                    {
                        case "cub_guess":
                            await handleCubGuess(options, guild, interaction)
                            return;
                        case "cub_get_roles":
                            await handleGetAll(guild, interaction);
                            return;
                    }
                }
                if(isCunning || admin){
                    switch(options.getSubcommand())
                    {
                        case "cunning_vote":
                            await handleCunningWolfVote(options, guild, interaction)
                            return;
                    }
                }
                else{
                    gen.reply(interaction, "You are not allowed to execute this command")
                }
            }
            finally{

            }
        })
    },
    async startup(){
        eventBus.subscribe('morning', bloodhoundInformation)
        //eventBus.subscribe('morning', ChangeCubRole)
        eventBus.subscribe('morning', ancientWolfTurning)
        eventBus.subscribe('evening', StartEvening)
        eventBus.subscribe('night', CheckKill)
        //eventBus.subscribe('night', CheckCubGuesses)
    }
}

//Admin Commands
async function handleSetWerewolfRoles(options, guild, interaction){
    const wwData = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"});
     
    if(wwData.specialFunctions.length == 0){
        await createRole(guild);
    }

    //check if role exists
    if(!wwData){
        await gen.reply(interaction, "This role does not exist yet.\n Please first create the role with the command **/role create**", true)
        return
    } 

    //check if users have been added
    if(wwData.roleMembers.length <= 0){
        await gen.reply(interaction, "No players have been added to this role yet.\n Please first add players the role with the command **/role add_user**", true)
        return
    }

    const ancientWolf = options.getUser("ancient_wolf");
    const bloodhound = options.getUser("bloodhound")
    const cunningWolf = options.getUser("cunning_wolf")
    const motherWolf = options.getUser("mother_wolf")
    const cub = options.getUser("cub")

    //Check for each entry if user is a werewolf
    if(!wwData.roleMembers.includes(ancientWolf)){
        if(ancientWolf !== null)
        {
            await gen.reply(interaction, "the user given in the ancient_wolf parameter is not a werewolf.**", true)
            return
        }
    }
    if(!wwData.roleMembers.includes(bloodhound)){
        if(bloodhound !== null)
        {
            await gen.reply(interaction, "the user given in the bloodhound parameter is not a werewolf.**", true)
            return
        }
    }
    if(!wwData.roleMembers.includes(cunningWolf)){
        if(cunningWolf !== null)
        {
            await gen.reply(interaction, "the user given in the cunning_wolf parameter is not a werewolf.**", true)
            return
        }
    }
    if(!wwData.roleMembers.includes(motherWolf)){
        if(motherWolf !== null)
        {
            await gen.reply(interaction, "the user given in the mother_wolf parameter is not a werewolf.**", true)
            return
        }
    }

    //Set ancient wolf
    if(ancientWolf != null){
        await rolesSchema.updateOne(
            {guildID: guild.id, 
                roleName: "werewolf"},
                {$set: {
                    "specialFunctions.0.ancientWolf": ancientWolf,
                    }}, 
            {options: {upsert: true}});
    }

    if(cunningWolf != null){
        await rolesSchema.updateOne(
            {guildID: guild.id, 
                roleName: "werewolf"},
                {$set: {          
                    "specialFunctions.0.cunningWolf": cunningWolf,
                    }}, 
            {options: {upsert: true}});
    }

    if(bloodhound != null){
        await rolesSchema.updateOne(
            {guildID: guild.id, 
                roleName: "werewolf"},
                {$set: {
                    "specialFunctions.0.bloodhound": bloodhound,
                    }}, 
            {options: {upsert: true}});
    }

    if(motherWolf != null){
        await rolesSchema.updateOne(
            {guildID: guild.id, 
                roleName: "werewolf"},
                {$set: {
                    "specialFunctions.0.motherWolf": motherWolf,
                    }}, 
            {options: {upsert: true}});
    }

    if(cub != null){
        await rolesSchema.updateOne(
            {guildID: guild.id, 
                roleName: "werewolf"},
                {$set: {
                    "specialFunctions.0.cub": cub,
                    }}, 
            {options: {upsert: true}});
    }

    gen.reply(interaction, "werewolf player roles set")
}
async function handleSetWerewolfChannels(options, guild, interaction){
    const wwData = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"});

    if(wwData.specialFunctions.length == 0){
        await createRole(guild);
    }
     
    //check if role exists
    if(!wwData){
        await gen.reply(interaction, "This role does not exist yet.\n Please first create the role with the command **/role create**", true)
        return
    } 

    if(wwData.specialFunctions.length <= 0){
        await createRole(guild)
    }

    await rolesSchema.updateOne(
        {guildID: guild.id, 
            roleName: "werewolf"},
        {$set: {
            "specialFunctions.0.cunningWolfChannel": options.getChannel("cunning_wolf_channel"),
            "specialFunctions.0.bloodhoundChannel": options.getChannel("bloodhound_channel"),
            "specialFunctions.0.motherAndCubChannel": options.getChannel("mother_and_cub_channel"),
            }}, 
        {options: {upsert: true}});
        gen.reply(interaction, "werewolf role channels set")

}
async function createRole(guild){
    await rolesSchema.updateOne(
        {guildID: guild.id, 
            roleName: "werewolf"},
        {$set: {
            specialFunctions: {
                ancientWolf: "",
                turned: false,
                turning: false,
                cunningWolf: "",
                cunningWolfChannel: "",
                cunningWolfVote: "",
                bloodhound: "",
                bloodhoundChecking: "",
                bloodhoundChannel: "",
                motherWolf: "",
                cub: "",
                motherAndCubChannel: "",
                canGuess: false,
                guessPlayers: [{player1: "", guess: ""}, {player2: "", guess: ""}],
                correct: "",
                grownUp: false,
                votes: [],
                canVote: false
            }}}, 
        {options: {upsert: true}});
}
//Admin Commands


//Commands
async function handleVoteNew(options, guild, interaction){

    //Get user they voted for
    const {client} = interaction;
    const wwData = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"});
    const commandUser = await users.findOne({guildID: guild.id, _id: interaction.user.id})
    const votedOnPlayerID = await options.getUser("player")
    const votedOnPlayerData = await users.findOne({guildID: guild.id, _id: votedOnPlayerID})

    if(commandUser.dead){
        gen.reply(interaction, "You are already dead")
        return;
    }
    if(wwData.roleMembers.includes(votedOnPlayerID.id)){
        gen.reply(interaction, "You cannot vote to kill one of your other werewolfs")
        return;
    }
    if(!wwData.specialFunctions[0].canVote){
        gen.reply(interaction, "You cannot vote at the current time")
        return
    }
    if(!votedOnPlayerData){
        gen.reply(interaction, "This user is not in the game")
        return
    }
    if(votedOnPlayerData.dead){
        gen.reply(interaction, "This player is already dead")
        return
    }

    //Check if command user has voted before and if so remove from old vote
    if(wwData.specialFunctions[0].votes.some(player => player.votedBy.includes(commandUser._id)))
    {
        console.log("removing from old")
        await rolesSchema.updateOne({
            guildID: guild.id, 
            "specialFunctions.0.votes.votedBy": commandUser._id
        }, 
        {
            $pull: {"specialFunctions.0.votes.$.votedBy": commandUser._id}
        }, 
        {options: {upsert: true}});
    }

    //Has this person been voted on before
    //If yes, add user to the votedBy array
    if(wwData.specialFunctions[0].votes.some(player => player.votedPlayer === votedOnPlayerID.id)){
        await rolesSchema.updateOne({
            guildID: guild.id, 
            "specialFunctions.0.votes.votedPlayer": votedOnPlayerID.id
        }, 
        {
            $push: {"specialFunctions.0.votes.$.votedBy": commandUser._id}
        }, 
        {options: {upsert: true}});
    }

    //else create new entry
    else{
        await rolesSchema.updateOne({guildID: guild.id}, {$push: {"specialFunctions.0.votes": {votedPlayer: votedOnPlayerID.id, votedBy: [commandUser._id]}}}, {options: {upsert: true}});
    }

    gen.SendToChannel(wwData.channelID, "Werewolf vote", gen.getName(interaction, interaction.user.id) + " voted for " + gen.getName(interaction, votedOnPlayerID.id), client, Colors.Red);
    gen.reply(interaction, "you voted.")


}
async function handleAncient(guild, interaction){
    const {client} = interaction
    const wwData = await rolesSchema.findOne( {guildID: guild.id, roleName: "werewolf"})
    
    if(interaction.user.id !== wwData.specialFunctions[0].ancientWolf){
        gen.reply(interaction, "You are not the ancient wolf");
        return;
    }

    if(wwData.specialFunctions[0].turned){
        gen.reply(interaction, "You cannot turn more than 1 person");
        return;
    }

    if(wwData.specialFunctions[0].turning){
        await rolesSchema.updateOne(
            {guildID: guild.id, roleName: "werewolf", "specialFunctions.turning": true, "specialFunctions.turned": false}, 
            {$set: {"specialFunctions.$.turning": false}},
            {options: {upsert: true}}
        )
    
        gen.SendToChannel(wwData.channelID, "Turning", "The ancient wolf has decided not to turn the the person you are eating", client, Colors.DarkOrange)
    }
    else{
        await rolesSchema.updateOne(
            {guildID: guild.id, roleName: "werewolf", "specialFunctions.turning": false, "specialFunctions.turned": false}, 
            {$set: {"specialFunctions.$.turning": true}},
            {options: {upsert: true}}
        )
    
        gen.SendToChannel(wwData.channelID, "Turning", "The anchient wolf has decided to turn the person you are eating tonight", client, Colors.DarkOrange)
    }

}
async function handleMotherAbility(options, guild, interaction){
    const {client} = interaction
    const wwData = await rolesSchema.findOne( {guildID: guild.id, roleName: "werewolf"})

    if(interaction.user.id !== wwData.specialFunctions[0].motherWolf){
        gen.reply(interaction, "You are not the mother wolf");
        return;
    }
    if(!wwData.specialFunctions[0].canGuess){
        gen.reply(interaction, "You cannot use this ability at this time", true);
        return;
    }
    if(wwData.specialFunctions[0].grownUp){
        gen.reply(interaction, "The cub has already grown up", true);
        return;
    }

    //Check if mother wolf
    
    const p1 = options.getUser("player1");
    const p2 = options.getUser("player2");

    const p1Data = users.findOne({guildID: guild.id, _id: p1});
    const p2Data = users.findOne({guildID: guild.id, _id: p2});

    //Check if both players are in the game
    if(!p1Data){
        gen.reply(interaction, "The player in the first parameter is not in the game");
        return;
    }
    if(!p2Data){
        gen.reply(interaction, "The player in the second parameter is not in the game");
        return;
    }

    //Check if both players are dead
    if(p1Data.dead){
        gen.reply(interaction, "The player in the first parameter already dead");
        return;
    }
    if(p2Data.dead){
        gen.reply(interaction, "The player in the second parameter already dead");
        return;
    }

    await rolesSchema.updateOne(
        {guildID: guild.id, 
            roleName: "werewolf"},
        {$set: {
            "specialFunctions.0.guessPlayers.0.player1": p1,
            "specialFunctions.0.guessPlayers.1.player2": p2,
            }}, 
        {options: {upsert: true}});

    gen.SendToChannel(wwData.specialFunctions[0].motherAndCubChannel, 
        "Guess the role", 
        "You need to guess the role of these 2 players: \n\n " 
        + 
        userMention(p1)
        + "\n" 
        + userMention(p2) + 
        "\n\n You can use **/werewolf cub_guess** to guess the roles of the players. \n You can use **/werewolf cub_get_roles** to see what roles exist. \n\n **THE MOTHER WOLF IS NOT ALLOWED TO HELP WITH THIS**" , client, Colors.DarkRed 
    )


}
async function handleCubGuess(options, guild, interaction){
    const {client} = interaction
    const wwData = await rolesSchema.findOne( {guildID: guild.id, roleName: "werewolf"})

    if(!wwData.specialFunctions[0].canGuess){
        gen.reply(interaction, "You cannot use this ability at this time", true);
        return;
    }
    if(wwData.specialFunctions[0].grownUp){
        gen.reply(interaction, "You have already grown up", true);
        return;
    }

    const guess1 = options.getString("guess_player1");
    const guess2 = options.getString("guess_player2");

    const role1Data = rolesSchema.findOne({guildID: guild.id, roleName: guess1});
    const role2Data = rolesSchema.findOne({guildID: guild.id, roleName: guess2});

    //Check if both players are in the game
    if(!role1Data){
        gen.reply(interaction, "the first role you guessed does not exist", true);
        return;
    }
    if(!role2Data){
        gen.reply(interaction, "the second role you guessed does not exist", true);
        return;
    }

    //Check if both players are dead
    await rolesSchema.updateOne(
        {guildID: guild.id, 
            roleName: "werewolf"},
        {$set: {
            "specialFunctions.0.guessPlayers.0.guess": guess1,
            "specialFunctions.0.guessPlayers.1.guess": guess2,
            }}, 
        {options: {upsert: true}});

    await gen.SendToChannel(wwData.specialFunctions[0].motherAndCubChannel, "Guesses",
        "You guessed: \n"+
        "player1 - " + guess1 + "\n" +
        "player2 - " + guess2 + "\n" +
        "You can still change your guess untill the start of the night", client, Colors.DarkRed
    )


}
async function handleGetAll(guild, interaction){
    const allEntries = await rolesSchema.find({guildID: guild.id})
    allRoleNames = "**Roles:** \n";

    await allEntries.forEach(entry => {
        allRoleNames = allRoleNames + `${entry.roleName}\n`
    });
        
    gen.reply(interaction, allRoleNames)
}
async function handleBloodHound(options, guild, interaction){
    const {client} = interaction
    const wwData = await rolesSchema.findOne( {guildID: guild.id, roleName: "werewolf"})
    const user = await users.findOne({guildID: guild.id, _id: options.getUser("player").id});

    if(interaction.user.id !== wwData.specialFunctions[0].bloodhound){
        gen.reply(interaction, "You cannot use this command", true);
        return;
    }

    if(user.dead){
        gen.reply(interaction, "The user you are trying to check is already dead", true);
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "werewolf"}, {$set: {"specialFunctions.0.bloodhoundChecking": options.getUser("player").id}})
    await gen.SendToChannel(wwData.specialFunctions[0].bloodhoundChannel, "Stalking", "You will be looking at " + userMention(options.getUser("player").id) + " tonight");
}
async function handleCunningWolfVote(options, guild, interaction){
    const {client} = interaction
    const wwData = await rolesSchema.findOne( {guildID: guild.id, roleName: "werewolf"})
    const user = await users.findOne({guildID: guild.id, _id: options.getUser("player").id});
    const game = await gameData.findOne({_id: guild.id});

    if(!game.canVote){
        gen.reply(interaction, "You currently can't vote", true);
        return;
    }

    if(user.dead){
        gen.reply(interaction, "The user you are trying to fake vote for is already dead", true);
        return;
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "werewolf"}, {$set: {"specialFunctions.0.cunningWolfVote": options.getUser("player").id}})

    await gen.SendToChannel(wwData.specialFunctions[0].cunningWolfChannel, 
        "Fake Vote", "You will fake vote for " + userMention(options.getUser("player").id) + " today! \n" +
        "Make sure to real vote with /lynch vote", 
        client);
}
//Commands


//Functionality
async function StartEvening([client, game]){
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"});
    if(!wwData || wwData.specialFunctions.length == 0){
        return;
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "werewolf"}, {$set: {"specialFunctions.0.canVote": true, "specialFunctions.0.votes": [], "specialFunctions.0.canGuess": true}}, {options: {upsert: true}});
    gen.SendToChannel(wwData.channelID, "You can now vote to eat someone!", "You have untill **" + game.times[0].night + "** to vote with **/werewolf kill_vote**", client);
}
async function CheckKill([client, game]){
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"})
    if(!wwData || wwData.specialFunctions.length == 0){
        return;
    }

    //Check if any votes
    if(wwData.specialFunctions[0].votes.length < 1){
        gen.SendToChannel(wwData.channelID, "VOTE CONCLUDED", "You did not vote to eat anyone", client, Colors.Red);
        gen.SendFeedback(wwData.guildID, "NO KILL", "The werewolfs have not voted to eat anyone", client, Colors.Blue)
    }
    else{
        //Sort votes
        const sortedVotes = wwData.specialFunctions[0].votes.sort((a, b) => {
            if (a.votedBy.length < b.votedBy.length) {
              return 1;
            }
            if (a.votedBy.length > b.votedBy.length) {
              return -1;
            }
            return 0;
        });
        let aliveWolfs = []

        //check how many alive members
        await wwData.roleMembers.forEach(async member => {
            aliveWolfs.push(await users.findOne({guildID: wwData._id, _id: member.id, dead: false})) 
        })

        //check if enough votes
        if(sortedVotes[0].votes < Math.ceil(aliveWolfs.length / 2)){
            gen.SendToChannel(wwData.channelID, "VOTE CONCLUDED", "You did not have enough votes to eat someone", client, Colors.Red);
            return;
        }

        //Check if turning
        if(wwData.specialFunctions[0].turning && !wwData.specialFunctions[0].turned){
            
            gen.SendToChannel(wwData.channel, "VOTE CONCLUDED", "You are going to turn **" + gen.getName(null, sortedVotes[0].votedPlayer, client) + "**", client, Colors.Red)

            wwData.roleMembers.forEach(async element => {
                let user = await users.findOne({_id: element, guildID: game._id});
    
                if(!user.dead){
                    await gen.LeftHouse(element, game._id);
                }
            });

            return;
        }

        //Kill person
        gen.SendToChannel(wwData.channelID, "VOTE CONCLUDED", "You decided to eat **" + gen.getName(null, sortedVotes[0].votedPlayer, client) + "**", client, Colors.Red)
        gen.SendFeedback(game._id, "Werewolf kill", "The werewolfs have decided to eat **" + gen.getName(null, sortedVotes[0].votedPlayer, client) + "**", client)
        gen.addToNightKilled(sortedVotes[0].id, game._id, client, "Werewolfs")

        wwData.roleMembers.forEach(async element => {
            let user = await users.findOne({_id: element, guildID: game._id});

            if(!user.dead){
                await gen.LeftHouse(element, game._id);
            }
        });
    }

    await rolesSchema.updateOne({guildID: wwData.guildID}, {$set: {"specialFunctions.0.canVote": false, "specialFunctions.0.canGuess": false}}, {upsert: true});
    await gen.SendToChannel(wwData.specialFunctions[0].motherAndCubChannel, "Locked in",
        "Your guesses have been locked in", client, Colors.DarkRed
    )
}
async function ancientWolfTurning([client, game]){
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"})

    if(!wwData || wwData.specialFunctions.length == 0){
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
            {guildID: wwData._id, roleName: "werewolf", "specialFunctions.0.turning": true, "specialFunctions.0.turned": false},
            {$set: {"specialFunctions.$.turned": true}},
            {upsert: true}
        )
        gen.addToChannel(sortedVotes[0].id, await gen.getChannel(client, wwData.channelID))
        return;
    }


    
}
async function CheckCubGuesses([client, game]){
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"})

    //Check if not already grown up
    if(wwData.specialFunctions[0].grownUp){
        return;
    }

    //Get actuall roles of guessed players
    const player1Role = await rolesSchema.findOne({guildID: wwData.guildID, roleMembers: wwData.specialFunctions[0].guessPlayers[0].player1});
    const player2Role = await rolesSchema.findOne({guildID: wwData.guildID, roleMembers: wwData.specialFunctions[0].guessPlayers[1].player2});

    //Check if p1 is correct // protection to if statement
    if(player1Role.roleName === wwData.specialFunctions[0].guessPlayers[0].guess)
    {
        await rolesSchema.updateOne({guildID: game._id, roleName: "werewolf"}, {$set: {"specialFunctions.0.correct": wwData.specialFunctions[0].guessPlayers[0].player1}}, {upsert: true});
        await gen.LeftHouse(wwData.specialFunctions[0].cub, game._id)
        gen.addToNightKilled(wwData.specialFunctions[0].guessPlayers[0].player1, game._id, client, "Cub")
        return;
    }
    if(player2Role.roleName === wwData.specialFunctions[0].guessPlayers[1].guess)
    {
        await rolesSchema.updateOne({guildID: game._id, roleName: "werewolf"}, {$set: {"specialFunctions.0.correct": wwData.specialFunctions[0].guessPlayers[1].player2}}, {upsert: true});
        await gen.LeftHouse(wwData.specialFunctions[0].cub, game._id)
        gen.addToNightKilled(wwData.specialFunctions[0].guessPlayers[1].player2, game._id, client, "Cub")
        return;
    }
}
async function ChangeCubRole([client, game]){
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"})

    //Check if not already grown up
    if(wwData.specialFunctions[0].grownUp){
        return;
    }

    //Check if p1 is correct // protection to if statement
    if(wwData.specialFunctions[0].correct != "" && wwData.specialFunctions[0].correct != null && wwData.specialFunctions[0].correct != undefined)
    {
        //Player was guessed correct
        //Cub will turn into werewolf in the morning


        //Send feedback to mods
        await gen.SendFeedback(game._id, "Cub Guessed correctly", "The cub guessed the role of **" + userMention(wwData.specialFunctions[0].correct) + "** correctly. They are turned into a werewolf!", client)
        //Add cub to werewolfs
        await gen.SendToChannel(wwData.specialFunctions[0].motherAndCubChannel, "You are growing up!", "You guessed the role of " + userMention(wwData.specialFunctions[0].correct) + " Correct \n You will now turn into a werewolf", client, Colors.Red);
        await gen.addToChannel(wwData.specialFunctions[0].cub, await gen.getChannel(client, wwData.channelID));
        await rolesSchema.updateOne({guildID: game._id, roleName: "werewolf"}, {$push: {roleMembers: wwData.specialFunctions[0].cub}}, {upsert: true});
        await rolesSchema.updateOne({guildID: game._id, roleName: "werewolf"}, {$set: {"specialFunctions.0.grownUp": true, "specialFunctions.0.guessPlayers": []}}, {upsert: true});

        return;
    }
    else{
        //Not guessed correctly
        await gen.SendToChannel(wwData.specialFunctions[0].motherAndCubChannel, "Still a cub", "You did not guess correctly", client, Colors.Red);

        await rolesSchema.updateOne({guildID: game._id, roleName: "werewolf"}, 
            {$set: 
                {"specialFunctions.0.guessPlayers": [
                    {
                        player1: "",
                        guess: ""
                    },
                    {
                        player2: "",
                        guess: ""
                    }]
                }}, {upsert: true});
    }
}
async function morningReset([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, 
            roleName: "werewolf"},
        {$set: {
            "specialFunctions.0.votes": [],
            "specialFunctions.0.canVote": false,
            "specialFunctions.0.guessPlayers.player1": p1,
            "specialFunctions.0.guessPlayers.player2": p2,
            }}, 
        {options: {upsert: true}});
}
async function bloodhoundInformation([client, game])
{
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"})

    if(!wwData || wwData.specialFunctions.length == 0){
        return;
    }

    if(wwData.specialFunctions[0].bloodhoundChecking != "" && wwData.specialFunctions[0].bloodhoundChecking != null && wwData.specialFunctions[0].bloodhoundChecking != undefined)
    {
        //Send feedback to mods
        await gen.SendFeedback(game._id, "Bloodhound Check", "Bloodhound checked " + userMention(wwData.specialFunctions[0].bloodhoundChecking) + "!", client)
        
        if(game.LeftHouse.includes(wwData.specialFunctions[0].bloodhoundChecking)) {
            await gen.SendToChannel(wwData.specialFunctions[0].bloodhoundChannel, "They left!", userMention(wwData.specialFunctions[0].correct) + " Left their house this night", client, Colors.Red);
        }
        else {
            await gen.SendToChannel(wwData.specialFunctions[0].bloodhoundChannel, "They did not leave!", userMention(wwData.specialFunctions[0].correct) + " did not leave their house this night", client, Colors.Red);
        }

        //Add cub to werewolfs
        await rolesSchema.updateOne({guildID: game._id, roleName: "werewolf"}, {$set: {"specialFunctions.0.bloodhoundChecking": ""}}, {upsert: true});

        return;
    }
}

//Functionality