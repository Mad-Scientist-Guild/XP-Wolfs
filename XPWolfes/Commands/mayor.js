const {SlashCommandBuilder, roleMention, channelMention, userMention} = require("@discordjs/builders");
const rolesSchema = require("../Schemas/roles-schema")
const users = require("../Schemas/users")
const mongo = require("../mongo");
const gameData = require("../Schemas/game-data");
const mayorData = require("../Schemas/mayor-schema");
const gen = require("../generalfunctions.js")
const {PermissionFlagsBits, Colors } = require("discord.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("mayor")
        .setDescription("all comands that have to do with the game")
        .addSubcommand(subcommand =>
            subcommand.setName('start_vote')
                .setDescription("start voting for mayor")
        )
        .addSubcommand(subcommand =>
            subcommand.setName('vote')
                .setDescription("set the mayor based on votes")
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("Player you want to vote for")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('end_vote')
                .setDescription('use to vote on player')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('successor')
                .setDescription("Choose a person to be your successor")
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("Player you want to be your successor")
                        .setRequired(true)
                )
        ),
    async execute(interaction){
        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{

                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "start_vote":
                            await handleStart(guild, interaction);
                            return;
                        case "end_vote":
                            await handleEnd(guild, interaction);
                            return;
                    }
                }
                if(admin || !admin){
                    switch(options.getSubcommand()){
                        case "vote":
                            await handleVote(options, guild, interaction);
                            return;
                        case "successor":
                            await ChooseSuccessor(options, guild, interaction, client);
                            return;
                    }
                }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    }
}

async function handleStart(guild, interaction){
    const mayor = await mayorData.findOne({_id: guild.id});

    if(mayor){
        await mayorData.updateOne({_id: guild.id}, {$set: {canVote: true, mayor: ""}}, {options: {upsert: true}})
    }else{
        await mayorData.create({
            _id: guild.id,
            canVote: true,
            mayor: "",
            votes: []
        })
    }
    gen.reply(interaction, "started mayor vote");
}

async function handleEnd(guild, interaction){
    const mayor = await mayorData.findOne({_id: guild.id});
    
    if(mayor && mayor.canVote){
        const votes = await mayor.votes;
        //sort
        const sorted = await votes.sort((a, b) => {
            if (a.votes < b.votes) {
              return 1;
            }
            if (a.votes > b.votes) {
              return -1;
            }
            return 0;
          });

        if(sorted[0]){
        //Check most votes
            if(sorted[1] && sorted[0].votes == sorted[1].votes){
                gen.SendAnouncement(interaction, "VOTE FOR MAYOR HAS ENDED!", "Due to a tie the vote has to happen again!" );
            }
            else{
                gen.SendAnouncement(interaction, "VOTE FOR MAYOR HAS ENDED!", userMention(sorted[0].id) + " is the new Mayor!");
                await users.updateOne({_id: sorted[0].id, guildID: guild.id}, {$set: {isMayor: true}}, {options: {upsert: true}});
            }

            await mayorData.updateOne({_id: guild.id}, {$set: {canVote: false, mayor: sorted[0].id, votes: []}}, {options: {upsert: true}})
            gen.reply(interaction, "vote ended")
        }
        else{
            gen.reply(interaction, "No-one was voted on");
        }
    }
    else{
        gen.reply(interaction, "There is no mayor vote at this moment")
    }
}

async function handleVote(options, guild, interaction){
    const {client} = interaction;
    const mayorVote = await mayorData.findOne({_id: guild.id});
    const game = await gameData.findOne({_id: guild.id});
    const user = await users.findOne({guildID: guild.id, _id: interaction.user.id})
    const votedOn = await options.getUser("player")

    if(mayorVote){
        if(CanVoteChecks(interaction, mayorVote, votedOn, game)){
            //update existing entry
            const exists = await CheckForExistence(mayorVote, votedOn);

            if(user.votedOnMayor != "" || user.votedOnMayor != undefined){
                await mayorData.updateOne({_id: guild.id, "votes.id": user.votedOnMayor}, {$inc: {"votes.$.votes": -1 }}, {options: {upsert: true}});
            }
            
            if(exists){
                await mayorData.updateOne({_id: guild.id, "votes.id": votedOn.id}, {$inc: {"votes.$.votes": 1 }}, {options: {upsert: true}});
            }
            //create new entry
            else{
                await mayorData.updateOne({_id: guild.id}, {$push: {votes: {id: votedOn.id, votes: 1}}}, {options: {upsert: true}});
            }

            //setting who the player voted on
            await setPlayerVotedOn(interaction, guild, votedOn);

            //replies
            gen.SendToChannel(game.voteChannel, gen.votedForPreset(interaction, interaction.user.id, votedOn.id), client );
            gen.reply(interaction, "you voted.")
        }
        else{
            gen.reply(interaction, "The vote for mayor has not started.")
        }
    }
}

async function CanVoteChecks(interaction, mayorData, votedOn, gameData){
    var canGo = true;

    if(interaction.user.id == votedOn.id){canGo = false}
    if(gameData.dead.includes(votedOn.id) || gameData.dead.includes(interaction.user.id)){canGo = false}
    if(!mayorData.canVote){canGo = false}

    return canGo;
}

async function setPlayerVotedOn(interaction, guild, votedOn){
    const userData = await users.findOne({guildID: guild.id, _id: interaction.user.id});

    if(userData){
        await users.updateOne({guildID: guild.id, _id: interaction.user.id}, {$set: {votedOnMayor: votedOn.id}}, {options: {upsert: true}});
    }

}

async function CheckForExistence(mayorVote, votedOn){
    return await mayorVote.votes.some(({ id }) => id === votedOn.id)
}

async function ChooseSuccessor(options, guild, interaction, client){
    const mayor = await users.findOne({_id: interaction.user.id})

    if(!mayor.isMayor){
        gen.reply(interaction, "You are not the mayor and cannot use this command")
        return;
    }
    
    await mayorData.updateOne({_id: guild.id}, {$set: {successor: options.getUser("player").id}})
    await gen.SendFeedback(guild.id, "Successor chosen", `The mayor has chosen **${gen.getName(interaction, options.getUser("player").id)}** as their successor`, client)
    await gen.reply(interaction, `You set **${gen.getName(interaction, options.getUser("player").id)}** as your successor`)
}