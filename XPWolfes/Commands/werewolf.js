const {SlashCommandBuilder, roleMention} = require("@discordjs/builders");
const mongo = require("../mongo");
const wwSchema = require("../Schemas/ww-schema");
const gen = require("../generalfunctions.js")
const users = require("../Schemas/users")
const gameData = require("../Schemas/game-data");
const { GuildMember, PermissionFlagsBits, Colors } = require("discord.js");
const rolesSchema = require("../Schemas/roles-schema");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("werewolf")
        .setDescription("remove a callout or message")
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Set the variables needed for the werewolfs')
                .addStringOption(option => 
                    option.setName("start_time")
                        .setDescription("in HH:MM")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("end_time")
                        .setDescription("in HH:MM")
                        .setRequired(true)
                )
                .addChannelOption(option => 
                    option.setName("channel")
                        .setDescription("channel")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('add user to this role')
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("player that you want to add")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand => 
            subcommand.setName('kill_vote')
                .setDescription("Please fill in the details for the role")
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("Please give the role you want to be mentioned")
                        .setRequired(true)
                    )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('ancient_power')
                .setDescription('Choose to turn a person')
        )
        ,
    async execute(interaction){
        const {member, options, guild} = interaction;
        const admin = member?.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const ww = await wwSchema.findOne({_id: guild.id});
                const isWW = await ww.members.some(({ id }) => id === interaction.user.id);
                //Admin commands
                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "set":
                            await handleSet(options, guild, interaction);
                            return;
                        case "add":
                            await handleAdd(options, guild, interaction);
                            return;
                    }
                }
                if(isWW || admin){
                //Other commands
                    switch(options.getSubcommand())
                    {
                        case "kill_vote":
                            await handleVote(options, guild, interaction);
                            return;
                        case "ancient_power":
                            await handleAncient(guild, interaction)
                            return;
                        default:
                            await gen.reply(interaction, `There is no functionality for this command.`)
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
    CheckKill
}

async function handleSet(options, guild, interaction){
    const ww = await wwSchema.findOne({_id: guild.id});
    const wwRole = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"})

    if(!wwRole){
        gen.reply(interaction, "Please first do **/role create werewolf**")
        return;
    }
    if(ww){
        await wwSchema.updateOne({_id: guild.id}, 
        {
            $set: {
                starttime: options.getString("start_time"),
                endtime: options.getString("end_time"),
                channel: options.getChannel("channel").id 
            }
        },
        {options:{upsert: true}}
        )
    } 
    else{
        console.log("creating new")
        await wwSchema.create({
            _id: guild.id,
            starttime: options.getString("start_time"),
            endtime: options.getString("end_time"),
            channel: options.getChannel("channel").id,
        })
    }

    await rolesSchema.updateOne(
        {guildID: guild.id, roleName: "werewolf"}, 
        {$set: {specialFunctions: {
            starttime: options.getString("start_time"),
            endtime: options.getString("end_time"),
            channel: options.getChannel("channel").id,
            votes: [],
            turning: false,
            turned: false 
        }}},
        {
            options: {upsert: true}
        }
    )
    gen.reply(interaction, "Set details for Werewolfs")

}

async function handleAdd(options, guild, interaction){
    const ww = await wwSchema.findOne({_id: guild.id});
    const werewolfRole = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"})
    if(!ww){
        gen.reply(interaction, "Please first setup the werewolf role with **/ww set**");
        return;
    }
    if(!werewolfRole){
        gen.reply(interaction, "Please first setup the werewolf role with **/ww set**");
        return;
    }

    await wwSchema.updateOne(
        {_id: guild.id}, 
        {$push: {members: {id: options.getUser("player").id, votedOn: ""}}}, 
        {options: {upsert: true}}
    )

    await rolesSchema.updateOne(
        {guildID: guild.id},
        {$push: {roleMembers: options.getUser("player").id}},
        {options: {upsert: true}}
    )

    gen.reply(interaction, "added user to werewolfs")


}

async function handleVote(options, guild, interaction){
    const {client} = interaction;
    const ww = await wwSchema.findOne({_id: guild.id});
    const game = await gameData.findOne({_id: guild.id});
    const user = await users.findOne({guildID: guild.id, _id: interaction.user.id})
    const votedOn = await options.getUser("player")
    const werewolfRole = await rolesSchema.findOne({guildID: guild.id, roleName: "werewolf"})
    const player = await ww.members.find(element => element.id == interaction.user.id);
    
    if(ww){
        if(werewolfRole.roleMembers.includes(votedOn.id)){
            gen.reply(interaction, "You cannot vote to kill one of your other werewolfs")
            return;
        }
        if(interaction.user.id == votedOn.id){
            gen.reply(interaction, "You cannot vote for yourself")
            return
        }
        if(game.dead.includes(interaction.user.id)){
            gen.reply(interaction, "You are already dead and cant vote")
            return
        }
        if(!ww.canVote){
            gen.reply(interaction, "You cannot vote at the current time")
            return
        }
        if(!player){
            gen.reply(interaction, "You are not a werewolf")
            return;
        }

        //update existing entry
        const exists = await CheckForExistence(ww, votedOn);

        if(player.votedOn != ""){
            //Remove old vote
            await wwSchema.updateOne({_id: guild.id, "votes.id": player.votedOn}, {$inc: {"votes.$.votes": -1}}, {options: {upsert: true}});
        }
        if(player.votedOn != votedOn.id){
            //add entry
            if(exists){
                await wwSchema.updateOne({_id: guild.id, "votes.id": votedOn.id}, {$inc: {"votes.$.votes": 1}}, {options: {upsert: true}});
            }
            //create new entry
            else{
                await wwSchema.updateOne({_id: guild.id}, {$push: {votes: {id: votedOn.id, votes: 1}}}, {options: {upsert: true}});
            }

            //Set New vote from player
            await wwSchema.updateOne({_id: guild.id, "members.id": interaction.user.id}, {$set: {"members.$.votedOn": votedOn.id}}, {options: {upsert: true}});

            //replies
            gen.SendToChannel(ww.channel, gen.getName(interaction, interaction.user.id) + " voted for " + gen.getName(interaction, votedOn.id), client );
            gen.reply(interaction, "you voted.")
        }
        else{
            gen.reply(interaction, "You can't vote on the same person twice")
        }
    }
    else{
        gen.reply(interaction, "The werewolfs are not set up on this server")
    }
}

async function CheckForExistence(wwVotes, votedOn){
    return await wwVotes.votes.some(({ id }) => id === votedOn.id)
}

async function handleAncient(guild, interaction){
    const wwRole = await rolesSchema.findOne( {guildID: guild.id, roleName: "werewolf"})
    
    if(wwRole.specialFunctions[0].turned){
        gen.reply(interaction, "You cannot turn more than 1 person");
    }

    if(wwRole.specialFunctions[0].turning){
        await rolesSchema.updateOne(
            {guildID: guild.id, roleName: "werewolf", "specialFunctions.turning": true, "specialFunctions.turned": false}, 
            {$set: {"specialFunctions.$.turning": false}},
            {options: {upsert: true}}
        )
    
        gen.reply(interaction, "The ancient wolf has decided not to turn the the person you are eating", false)
    }
    else{
        await rolesSchema.updateOne(
            {guildID: guild.id, roleName: "werewolf", "specialFunctions.turning": false, "specialFunctions.turned": false}, 
            {$set: {"specialFunctions.$.turning": true}},
            {options: {upsert: true}}
        )
    
        gen.reply(interaction, "The anchient wolf has decided to turn the person you are eating tonight", false)
    }

}

async function CheckKill(client, wwData){
    const wwRoleData = await rolesSchema.findOne({guildID: wwData._id, roleName: "werewolf"})
 
    //Check if any votes
    if(wwData.votes.length < 1){
        gen.SendToChannel(wwData.channel, "You did not vote to eat anyone", client);
        gen.SendFeedback(wwData._id, "NO KILL", "The werewolfs have not voted to eat anyone", client, Colors.Blue)
        return;
    }
    
    //Sort votes
    const sortedVotes = wwData.votes.sort((a, b) => {
        if (a.votes < b.votes) {
          return 1;
        }
        if (a.votes > b.votes) {
          return -1;
        }
        return 0;
    });

    let aliveWolfs = []
    //check how many alive members
    await wwData.members.forEach(async member => {
        aliveWolfs.push(await users.findOne({guildID: wwData._id, _id: member.id, dead: false})) 
    })
    
    //check if enough votes
    console.log(sortedVotes[0])
    if(sortedVotes[0].votes < Math.ceil(aliveWolfs.length / 2)){
        gen.SendToChannel(wwData.channel, "You did not have enough votes to eat someone", client);
        return;
    }

    //Check if turning
    if(wwRoleData.specialFunctions[0].turning && !wwRoleData.specialFunctions[0].turned){
        const channel = client.channels.cache.get(wwData.channel);
        gen.addToChannel(sortedVotes[0].id, channel)
        gen.SendToChannel(wwData.channel, "You have turned **" + gen.getName(null, sortedVotes[0].id, client) + "**", client)
        return;
    }

    //Kill person
    gen.SendToChannel(wwData.channel, "You decided to eat **" + gen.getName(null, sortedVotes[0].id, client) + "**", client)
    gen.SendFeedback(wwData._id, "Werewolf kill", "The werewolfs have decided to eat **" + gen.getName(null, sortedVotes[0].id, client) + "**", client)
    gen.addToNightKilled(sortedVotes[0].id, wwData._id, client, "Werewolfs")

    await wwSchema.updateOne({_id: wwData._id}, {canVote: false});
}