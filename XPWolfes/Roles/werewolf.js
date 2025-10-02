const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const gen = require("../generalfunctions.js")
const users = require("../Schemas/users.js")
const gameData = require("../Schemas/game-data.js");
const { GuildMember, PermissionFlagsBits, Colors } = require("discord.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const getters = require("../GeneralApi/Getter.js")

module.exports = {
    data : new SlashCommandBuilder()
        .setName("werewolf")
        .setDescription("All commands revolving werewolf role")  
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
        ,
    async execute(interaction){
        const {member, options, guild} = interaction;
        const admin = member?.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const user = await users.findOne({guildID: guild.id, _id: interaction.user.id});
                const role = await getters.GetRole(guild.id, "werewolf");
                const isRole = (role.roleMembers.includes(interaction.user.id));

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
                if(isRole || admin){
                //Other commands
                    switch(options.getSubcommand())
                    {
                        case "kill_vote":
                            await handleVoteNew(options, guild, interaction);
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
        eventBus.subscribe('morning', morningReset)
        eventBus.subscribe('evening', StartEvening)
        eventBus.subscribe('night', CheckKill)
        eventBus.subscribe("rolesCreated", createRole);

    }
}

async function createRole([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, 
            roleName: "werewolf"},
        {$set: {
            specialFunctions: {
                votes: [],
                canVote: false
            }}}, 
        {options: {upsert: true}});
}


//Commands
async function handleVoteNew(options, guild, interaction){
    //Get user they voted for
    const {client} = interaction;
    const wwData = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"});
    const commandUser = await users.findOne({guildID: guild.id, _id: interaction.user.id})
    const votedOnPlayerID = await options.getUser("player").id
    const votedOnPlayerData = await users.findOne({guildID: guild.id, _id: votedOnPlayerID})

    if(commandUser.dead){
        gen.reply(interaction, "You are already dead")
        return;
    }
    if(wwData.roleMembers.includes(votedOnPlayerID)){
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
    if(wwData.specialFunctions[0].votes.some(player => player.votedPlayer === votedOnPlayerID)){
        await rolesSchema.updateOne({
            guildID: guild.id, roleName: "werewolf",
            "specialFunctions.0.votes.votedPlayer": votedOnPlayerID
        }, 
        {
            $push: {"specialFunctions.0.votes.$.votedBy": commandUser._id}
        }, 
        {options: {upsert: true}});
    }

    //else create new entry
    else{
        await rolesSchema.updateOne({guildID: guild.id, roleName: "werewolf"}, 
            {$push: {"specialFunctions.0.votes": {votedPlayer: votedOnPlayerID, votedBy: [commandUser._id]}}}, {options: {upsert: true}});
    }

    gen.SendToChannel(wwData.channelID, "Werewolf vote", userMention(interaction.user.id) + " voted for " + userMention(votedOnPlayerID), client, Colors.Red);
    gen.reply(interaction, "you voted.")


}

//Commands

//Functionality
async function StartEvening([client, game]){
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"});
    if(!wwData || wwData.specialFunctions.length == 0){
        return;
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "werewolf"}, 
        {$set: {"specialFunctions.0.canVote": true, "specialFunctions.0.votes": []}}, 
        {options: {upsert: true}});

    gen.SendToChannel(wwData.channelID, "You can now vote to eat someone!", "You have untill **" + game.times[0].night + "** to vote with **/werewolf kill_vote**", client);
}
async function CheckKill([client, game]){
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"})
    const ancient = await getters.GetRole(game._id, "ancient-wolf")

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
        if(ancient.specialFunctions[0].turning && !ancient.specialFunctions[0].turned){
            
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
        gen.SendToChannel(wwData.channelID, "VOTE CONCLUDED", "You decided to eat **" + userMention(sortedVotes[0].votedPlayer) + "**", client, Colors.Red)
        gen.SendFeedback(game._id, "Werewolf kill", "The werewolfs have decided to eat **" + userMention(sortedVotes[0].votedPlayer) + "**", client)
        gen.addToNightKilled(sortedVotes[0].votedPlayer, game._id, client, "Werewolfs")

        wwData.roleMembers.forEach(async element => {
            let user = await users.findOne({_id: element, guildID: game._id});

            if(!user.dead){
                await gen.LeftHouse(element, game._id);
            }
        });
    }

    await rolesSchema.updateOne({guildID: wwData.guildID}, {$set: {"specialFunctions.0.canVote": false}}, {upsert: true});
}
async function morningReset([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, 
            roleName: "werewolf"},
        {$set: {
            "specialFunctions.0.votes": [],
            "specialFunctions.0.canVote": false,
            }}, 
        {options: {upsert: true}});
}
//Functionality