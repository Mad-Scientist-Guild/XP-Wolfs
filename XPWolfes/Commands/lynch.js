const {SlashCommandBuilder, roleMention, channelMention, userMention} = require("@discordjs/builders");
const rolesSchema = require("../Schemas/roles-schema")
const users = require("../Schemas/users")
const mongo = require("../mongo");
const gameData = require("../Schemas/game-data");
const voteSchema = require("../Schemas/vote-schema");
const gen = require("../generalfunctions.js");
const { PermissionFlagsBits } = require("discord.js");
const {eventBus} = require('../MISC/EventBus.js')


module.exports = {
    data : new SlashCommandBuilder()
        .setName("lynch")
        .setDescription("all comands that have to do with the game")
        .addSubcommand(subcommand =>
            subcommand.setName('vote')
                .setDescription('use to vote on player')
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("Player you want to vote for")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('vote_abstain')
                .setDescription('use to vote on player')
        ),
    async execute(interaction){
        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        await mongo().then(async mongoose => {
            try{
                if(!admin || admin){
                    switch(options.getSubcommand())
                    {
                        case "vote_abstain":
                            await handleVoteAbstained(guild, interaction, client);
                            return;
                        case "vote":
                            await handleVote(options, guild, interaction);
                            return;
                    }
                }
                else{
                    gen.reply(interaction, "You cant use this command")
                }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    },
    async startup(){
        eventBus.subscribe('afternoon', handleVoteStart)
        eventBus.subscribe('evening', handleVoteEnd)
    }
}

//Commands
async function NewVote(interaction, guild, VotedOn){
    const {client} = interaction;
    //Create a new vote
    const voteData = await voteSchema.findOne({_id: VotedOn, guildID: guild.id})
    const target = await users.findOne({_id: VotedOn, guildID: guild.id})
    const game = await gameData.findOne({_id: guild.id})

    const cunning = await rolesSchema.findOne({guildID: guild.id, roleName: "cunningwolf"})

    let isCunning;
    if(cunning){
        isCunning = cunning.roleMembers.includes(interaction.user.id)
    } 

    if(!target.dead && target){
        if(voteData){
            //If someone has already voted on this person before.
            await voteSchema.updateOne({_id: VotedOn, guildID: guild.id}, {$push: {votedBy: interaction.user.id}}, {options: {upsert: true}});
        }
        else{
            await voteSchema.create({
                _id: VotedOn,
                guildID: guild.id,
                votedBy: [interaction.user.id]
            })
        }
        await users.updateOne({_id: interaction.user.id, guildID: guild.id}, {$set: {votedOn: VotedOn, voted: true}}, {options: {upsert: true}});
        if(isCunning){
            gen.reply(interaction, "You actually voted now");
            return;
        }
        gen.SendToChannel(game.voteChannel, "LYNCH VOTE", "**" + gen.getName(interaction, interaction.user.id) + "** has voted on **" + gen.getName(interaction, VotedOn) + "** to lynch", client)
        gen.noReply(interaction);
    }
    else{
        gen.reply(interaction, "this person is already dead", true);
    }
}
async function handleVote(options, guild, interaction){
    const {client} = interaction;
    const game = await gameData.findOne({_id: guild.id});
    const votedPerson = await options.getUser("player").id;
    const alivePlayers = await game.alive;
    const isPlaying = await alivePlayers.includes(votedPerson);
    
    const cunning = await rolesSchema.findOne({guildID: guild.id, roleName: "cunningwolf"})
    let isCunning;
    if(cunning){
        isCunning = cunning.roleMembers.includes(interaction.user.id)
    } 
    if(!game){
        gen.reply(interaction, "There is no game yet, Please use /game create to make a new game")
        return;
    }
    if(!game.canVote){
        gen.reply(interaction, "You cannot vote yet.")
        return;
    }
    if(!isPlaying){
        gen.reply(interaction, "This person is already dead or not playing")
        return;
    }
    const player = await users.findOne({_id: interaction.user.id, guildID: guild.id})
    if(player.dead){
        gen.reply(interaction, "You are already dead", true);
        return;
    }
    
    //Handle cunning wolf
    if(isCunning && interaction.channel.id != cunning.channelID){
        gen.SendToChannel(game.voteChannel, "LYNCH VOTE", "**" + gen.getName(interaction, interaction.user.id) + "** has voted on **" + gen.getName(interaction, votedPerson) + "** to lynch", client)
        gen.noReply(interaction);
        return;
    }

    if(player.voted)
    {
        //Change vote unless same vote
        await changeVote(interaction, guild, player.votedOn, votedPerson)
    }
    else
    {
        //vote for something new
        await NewVote(interaction, guild, votedPerson);
    }
}  
async function changeVote(interaction, guild, oldVote, newVote){
    //Change vote unless same vote
    if(newVote != oldVote)
    {
        //change Vote
        await voteSchema.updateOne({_id: oldVote, guildID: guild.id}, {$pull: {"votedBy": interaction.user.id}}, {options: {upsert: true}});

        await NewVote(interaction, guild, newVote)
    } 
    else{
        gen.reply(interaction, "You have already voted on this person")
    }
}
async function handleVoteAbstained(guild, interaction, client){
    const game = await gameData.findOne({_id: guild.id});
    const player = await users.findOne({_id: interaction.user.id, guildID: guild.id})
    const oldVote = await player.votedOn;
    const AbstainedExists = await voteSchema.findOne({_id: "Abstained", guildID: guild.id})

    if(!AbstainedExists){
        await voteSchema.create({
            _id: "Abstained",
            guildID: guild.id,
            votedBy: []
        })
    }

    if(game && game.canVote)
    {
        if(oldVote) {
            await voteSchema.updateOne({_id: oldVote, guildID: guild.id}, {$pull: {"votedBy": interaction.user.id}}, {options: {upsert: true}});
        }

        await voteSchema.updateOne({_id: "Abstained", guildID: guild.id}, {$push: {votedBy: interaction.user.id}}, {options: {upsert: true}})
        await users.updateOne({_id: interaction.user.id, guildID: guild.id}, {$set: {votedOn: "Abstained", voted: true}}, {options: {upsert: true}});
        await gen.SendToChannel(game.voteChannel, "LYNCH VOTE", "**" + gen.getName(interaction, interaction.user.id) + "** has abstained from voting", client)
        gen.reply(interaction, "**" + gen.getName(interaction, interaction.user.id) + "** Abstained from voting", true)
    }
    else{
        gen.reply(interaction, "You cannot vote yet.", true)
    }
}
//Commands


//Functionality
async function handleVoteStart([client, game]){
    if(game.started && !game.finished){
        await gameData.updateOne({_id: game._id}, {$set: {canVote: true}}, {options: {upsert: true}});
        gen.SendAnouncement(undefined, "VOTE STARTED","**You can now vote to lynch someone!**", game, client)
    } 
}
async function handleVoteEnd([client, game]){
    //Make voting no longer possible
    await gameData.updateOne({_id: game._id}, {$set: {canVote: false}}, {options: {upsert: true}});

    //check who didnt vote and add to abstained
    const didntVote = await users.find({guildID: game._id, voted: false, dead: false});
    const absExists = await voteSchema.findOne({guildID: game._id, _id: "Abstained"})

    if(!absExists){
        await voteData.create({
            _id: "Abstained",
            guildID: game._id,
            votedBy: []
        })
    }
    
    await handleAddToAbstained(didntVote, game)

    const votedata = await voteSchema.find({guildID: game._id})
    //get and sort the data of voting
    const sorted = await votedata.sort((a, b) => {
        if (a.votedBy.length < b.votedBy.length) {
          return 1;
        }
        if (a.votedBy.length > b.votedBy.length) {
          return -1;
        }
        return 0;
      });

    const alivePlayers = await users.find({guildID: game._id, "dead": false});

    //Check if most people vote for abstained
    if(sorted[0]._id == "Abstained" && sorted[0].votedBy.length >= Math.floor(alivePlayers.length / 2)){
        gen.SendAnouncement(undefined, "Voting has concluded", `Most people voted to Abstain`, game, client)
        return;
    }
    
    //if not, check most votes
    else {
        var sameSize = []

        sorted.forEach(async person => {
            if(person._id == "Abstained"){}
            else if(person.votedBy.length == sorted[0].votedBy.length){
                sameSize.push(person);
            }
        })

        if(sameSize.length == 1){
            gen.SendAnouncement(undefined, "Voting has concluded", `Most people voted to lynch ${userMention(sameSize[0]._id)} with ${sameSize[0].votedBy.length} votes`, game, client)
            gen.Kill(sameSize[0]._id, game._id, client, gen.getGuild(client, game._id))
        } 
        else{
            //check for mayor
            var personToKill = undefined;
            const mayor = await users.findOne({guildID: game._id, isMayor: true})
            if(mayor){
                sameSize.forEach(async person =>{
                    if(person.votedBy.includes(mayor._id)){
                        personToKill = person;
                    }
                })
            }

            if(personToKill != undefined){
                gen.SendAnouncement(undefined, "Voting has concluded", `There was a TIE, but the Mayor has voted to lynch ${userMention(personToKill._id)}`, game, client)
                gen.Kill(personToKill._id, game._id, client)
            }
            else{ gen.SendAnouncement(undefined, "Voting has concluded", `There is a **TIE**. No-one gets lynched`, game, client) }
        }
    }

    //Reset vote data
    await voteSchema.deleteMany({guildID: game._id})
    await users.updateMany({guildID: game._id, voted: true}, {$set: {votedOn: "", voted: false}}, {options: {upsert: true}})
}
async function handleAddToAbstained(didntVote, game){
    await didntVote.forEach(async player => {
        await voteSchema.updateOne({_id: "Abstained", guildID: game._id}, {$push: {votedBy: player._id}}, {options: {upsert: true}})
    })
}
//Functionality
