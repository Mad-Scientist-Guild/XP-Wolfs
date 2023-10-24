const {SlashCommandBuilder, roleMention, channelMention, userMention} = require("@discordjs/builders");
const rolesSchema = require("../Schemas/roles-schema")
const users = require("../Schemas/users")
const gamedata = require("../Schemas/game-data")
const mongo = require("../mongo");
const gameData = require("../Schemas/game-data");
const voteSchema = require("../Schemas/vote-schema");
const gen = require("../generalfunctions.js");
const { PermissionFlagsBits } = require("discord.js");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("lynch")
        .setDescription("all comands that have to do with the game")
        .addSubcommand(subcommand =>
            subcommand.setName('lynch_start_time')
                .setDescription("set the start time of voting")
                .addStringOption(option => 
                    option.setName("time")
                        .setDescription("Time in HH:MM")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('lynch_end_time')
                .setDescription("set the end time of voting")
                .addStringOption(option => 
                    option.setName("time")
                        .setDescription("Time in HH:MM")
                        .setRequired(true)
                )
        )
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
        const {member, options, guild} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        await mongo().then(async mongoose => {
            try{
                if(!admin || admin){
                    switch(options.getSubcommand())
                    {
                        case "vote_abstain":
                            await handleVoteAbstained(guild, interaction);
                            return;
                        case "vote":
                            await handleVote(options, guild, interaction);
                            return;
                    }
                }
                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "lynch_start_time":
                            await handleStartTime(options, guild, interaction);
                            return;
                        case "lynch_end_time":
                            await handleEndTime(options, guild, interaction);
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
    }
}

async function handleStartTime(options, guild, interaction){
    const game = gameData.findOne({_id: guild.id});

    if(game)
    {
        await gameData.updateOne({_id: guild.id}, {$set: {"lynchTimeStart": options.getString("time")}}, { options: { upsert: true }})
        console.log("setting lynch time start to: " + options.getString("time"))
        gen.reply(interaction, "Lynch start time set")
    }
    else{
        gen.reply(interaction, "There is no game yet, Please use /game create to make a new game")
    }
}

async function handleEndTime(options, guild, interaction){
    const game = await gameData.findOne({_id: guild.id});

    if(game)
    {
        await gameData.updateOne({_id: guild.id}, {$set: {lynchTimeEnd: options.getString("time")}}, { options: { upsert: true }})
        gen.reply(interaction, "Lynch end time set")
    }
    else{
        gen.reply(interaction, "There is no game yet, Please use /game create to make a new game")
    }
}

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

async function handleVoteAbstained(guild, interaction){
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
