const {SlashCommandBuilder, roleMention, EmbedBuilder, channelMention } = require("@discordjs/builders");
const mongo = require("../mongo");
const { MessageEmbed, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const brothersSchema = require("../Schemas/brothers-schema");
const gen = require("../generalfunctions.js")
const users = require("../Schemas/users")

module.exports = {
    data : new SlashCommandBuilder()
        .setName("brothers")
        .setDescription("return the current time")
        .addSubcommand(subcommand => 
            subcommand.setName("add")
                .setDescription("vote for person you want to add as brother")
                .addUserOption(option => 
                    option.setName("new-brother")
                        .setDescription("person to add")
                        .setRequired(true)
                ))
        .addSubcommand(subcommand => 
            subcommand.setName("set")
                .setDescription("Select the player you want to be cupid")
                .addUserOption(option => 
                    option.setName("brother1")
                        .setDescription("Brother 1")
                        .setRequired(true)
                )
                .addUserOption(option => 
                    option.setName("brother2")
                        .setDescription("Brother 3")
                        .setRequired(true)
                )
                .addUserOption(option => 
                    option.setName("brother3")
                        .setDescription("Brother 3")
                        .setRequired(true)
                )
                .addChannelOption(option => 
                    option.setName("brothers-chat")
                        .setDescription("Cupid's channel")
                        .setRequired(true)
                )         
        ),
    async execute(interaction){
        const {member, options, guild} = interaction;
        
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const brotherData = await brothersSchema.findOne({_id: guild.id});
                if(brotherData) { 
                    isBrother = await brotherData.brothers.includes(interaction.user.id)
                }
                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "set":
                            await handleSet(options, guild, interaction);
                            return;
                    }
                }
                if(isBrother || admin){
                    if(interaction.channel.id === brotherData.channel){
                        switch(options.getSubcommand())
                        {
                            case "add":
                                await handleAdd(options, guild, interaction);
                                return;
                        }
                    }
                    else{
                        gen.reply(interaction, "You can not use this command in this channel");
                    }
                }
                else{
                    gen.reply(interaction, "You do not have permission to use this command");
                }
            }
            finally{
                mongoose.connection.close();
            }
        })
    }
}

async function handleSet(options, guild, interaction){
    const {client} = interaction;

     const brothersData = await brothersSchema.findOne({_id: guild.id});
     const b1 = options.getUser("brother1").id
     const b2 = options.getUser("brother2").id
     const b3 = options.getUser("brother3").id
     const channel = options.getChannel("brothers-chat").id

     if(brothersData){
        //update data that already exists
        await brothersSchema.updateOne({_id: guild.id}, 
            {$set: 
                {
                    brothers: [{id: b1, votedOn: ""}, {id: b2, votedOn: ""}, {id: b3, votedOn: ""}],
                    channel: channel,
                    newBrotherVotes: [],
                    addedBrother: ""
                }
            },
            {options: {upsert: true}}
        )
    }
    else{
        //Make new entry
        await brothersSchema.create({
            _id: guild.id,
            brothers: [{id: b1, votedOn: ""}, {id: b2, votedOn: ""}, {id: b3, votedOn: ""}],
            channel: channel,
            newBrotherVotes: [],
            addedBrother: ""
        })
    }

    const brothersChannel = await guild.channels.cache.get(channel);
    gen.addToChannel(b1, brothersChannel);
    gen.addToChannel(b2, brothersChannel);
    gen.addToChannel(b3, brothersChannel);
    
    gen.reply(interaction, "brothers set")
    gen.SendToChannel(channel, gen.getName(interaction, b1) + " " + gen.getName(interaction, b2) + " " + gen.getName(interaction, b3) + ". You 3 are the brothers!", client)
}
    
async function handleAdd(options, guild, interaction){
    const {client} = interaction

    //check if brothers are set up
    const brotherData = await brothersSchema.findOne({_id: guild.id});

    if(brotherData){
        //Get all needed data
        const newBrotherID = options.getUser("new-brother").id;
        const b1 = brotherData.brothers[0].id
        const b1Data = await users.findOne({_id: b1, guildID: guild.id})
        const b2 = brotherData.brothers[1].id
        const b2Data = await users.findOne({_id: b2, guildID: guild.id})
        const b3 = brotherData.brothers[2].id
        const b3Data = await users.findOne({_id: b3, guildID: guild.id})
        const channel = brotherData.channel

        //Check if you are not voting for yourself
        if(b1 == newBrotherID || b2 == newBrotherID || b3 == newBrotherID){
            gen.reply(interaction, "You cannot choose one of the already existing brothers to join you");
            return;
        }

        //check if the one you voted on already has a vote
        const exists = await CheckForExistence(brotherData.newBrotherVote, newBrotherID);

        //check if voted on someone else and remove vote from old
        const player = await brotherData.brothers.find(element => element.id == interaction.user.id);
        const playerUserData = await users.findOne({_id: interaction.user.id, guildID: guild.id})
        const votedOnUserData = await users.findOne({_id: newBrotherID, guildID: guild.id})

        ///----------------------------------------------------------------------------------------
        ///                                 CHECKS
        ///----------------------------------------------------------------------------------------
        if(playerUserData.dead){
            gen.reply(interaction, "You are already dead and cant vote for a new brother");
            return;
        }
        if(player.votedOn == newBrotherID){
            gen.reply(interaction, "You already voted for this person")
            return;
        }
        if(!votedOnUserData){
            gen.reply(interaction, "This person isn't playing");
            return;
        }
        if(votedOnUserData.dead){
            gen.reply(interaction, "This person is already dead");
            return;
        }

        ///----------------------------------------------------------------------------------------
        ///                                 LOGIC
        ///----------------------------------------------------------------------------------------

        //Remove old vote
        if(player.votedOn != ""){
            await brothersSchema.updateOne({_id: guild.id, "newBrotherVote.id": player.votedOn}, {$inc: {"newBrotherVote.$.votes": -1}}, {options: {upsert: true}});
        }
        //increment existing entry
        if(exists){
            await brothersSchema.updateOne({_id: guild.id, "newBrotherVote.id": newBrotherID}, {$inc: {"newBrotherVote.$.votes": 1}}, {options: {upsert: true}});
        }
        //create new entry
        else{
            await brothersSchema.updateOne({_id: guild.id}, {$push: {newBrotherVote: {id: newBrotherID, votes: 1}}}, {options: {upsert: true}});
        }
        
        //Set New vote from player
        await brothersSchema.updateOne({_id: guild.id, "brothers.id": interaction.user.id}, {$set: {"brothers.$.votedOn": newBrotherID}}, {options: {upsert: true}});
        gen.SendToChannel(channel, gen.votedForPreset(interaction, interaction.user.id, newBrotherID), client );

        //Check if 3 votes, then add to channel
        
        const newBrotherData = await brothersSchema.findOne({_id: guild.id})
        let votesNeeded = 3;
        if(b1Data.dead){ votesNeeded = votesNeeded - 1;}
        if(b2Data.dead){ console.log("b2 dead"); votesNeeded = votesNeeded - 1;}
        if(b3Data.dead){ votesNeeded = votesNeeded - 1;}

        const allVoted = await newBrotherData.newBrotherVote.some(({ votes }) => votes === votesNeeded)

        if(allVoted){
            gen.SendToChannel(channel, "You all voted for " + gen.getName(interaction, allVoted.id)+". They will be added to the chat!", client );
            const brothersChannel = await guild.channels.cache.get(channel);
            gen.addToChannel(threevotes.id, brothersChannel)
        }

        //replies
        gen.reply(interaction, "you voted.")
        
    }
    else{
        gen.reply(interaction, "Please first setup the brothers first with /brothers set")
    }
}

async function CheckForExistence(votes, votedOn){
    return await votes.some(({ id }) => id === votedOn.id)
}