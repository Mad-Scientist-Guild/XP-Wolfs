const {SlashCommandBuilder, roleMention, EmbedBuilder, channelMention } = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { MessageEmbed, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const gen = require("../generalfunctions.js")
const users = require("../Schemas/users.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const getters = require("../GeneralApi/Getter.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("brothers")
        .setDescription("return the current time")
        .addSubcommand(subcommand => 
            subcommand.setName("vote")
                .setDescription("vote for person you want to add as brother")
                .addUserOption(option => 
                    option.setName("new-brother")
                        .setDescription("person to add")
                        .setRequired(true)
                )    
        ),
    async execute(interaction){
        const {member, options, guild} = interaction;
        
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const brotherData = await getters.GetRole(guild.id, "brothers");
                if(brotherData) { 
                    isBrother = await brotherData.roleMembers.includes(interaction.user.id)
                }
                if(isBrother || admin){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                    if(interaction.channel.id === brotherData.channelID){
                        switch(options.getSubcommand())
                        {
                            case "vote":
                                await handleVote(options, guild, interaction);
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
                //mongoose.connection.close();
            }
        })  
    },
    async startup(){
        eventBus.subscribe("rolesCreated", createRole);
    }
}
    
async function handleVote(options, guild, interaction){
    const brother = await users.findOne({_id: interaction.user.id, guildID: guild.id});
    const votedFor = await users.findOne({_id: options.getUser("new-brother").id, guildID: guild.id});
    const brothersData = await rolesSchema.findOne({guildID: guild.id, roleName: "brothers"});

    if(!brothersData.specialFunctions[0].canVote){
        gen.reply(interaction, "you have already chosen to add someone")
        return;
    }

    //Check if user is dead
    if(brother.dead){
        gen.reply(interaction, "You are already dead");
        return;
    }
    //Check if who was voted for is already dead
    if(votedFor.dead){
        gen.reply(interaction, "The person you voted for is already dead");
        return;
    }

    //Set the voted for person correctly
    switch(brothersData.roleMembers.indexOf(interaction.user.id))
    {
        case 0:
            await rolesSchema.updateOne({guildID: guild.id, roleName: "brothers"}, 
                {$set: 
                    {
                        "specialFunctions.0.b1Voted": votedFor._id,
                    }
                },
                {options: {upsert: true}}
            )      
            break;
        case 1:
            await rolesSchema.updateOne({guildID: guild.id, roleName: "brothers"}, 
                {$set: 
                    {
                        "specialFunctions.0.b2Voted": votedFor._id,
                    }
                },
                {options: {upsert: true}}
            )
            break;
        case 2:
            await rolesSchema.updateOne({guildID: guild.id, roleName: "brothers"}, 
                {$set: 
                    {
                        "specialFunctions.0.b3Voted": votedFor._id,
                    }
                },
                {options: {upsert: true}}
            )
            break;
    }

    //TODO: handle check if all votes are the same
    await checkVotes(options, guild, interaction);

}

async function checkVotes(options, guild, interaction){
    const {client} = interaction;
    const brothersDataRefresh = await rolesSchema.findOne({guildID: guild.id, roleName: "brothers"});

    const b1 = await getters.GetUser(brothersDataRefresh.roleMembers[0], guild.id);
    const b2 = await getters.GetUser(brothersDataRefresh.roleMembers[1], guild.id);
    const b3 = await getters.GetUser(brothersDataRefresh.roleMembers[2], guild.id);

    let votes = [];

    if(!b1.dead){
        await votes.push(brothersDataRefresh.specialFunctions[0].b1Voted);
    }
    if(!b2.dead){
         await votes.push(brothersDataRefresh.specialFunctions[0].b2Voted);
    }
    if(!b3.dead){
    //     await votes.push(brothersDataRefresh.specialFunctions[0].b3Voted);
    }

    const AllEqual = arr => arr.every(v => v=== arr[0]);
    if(AllEqual(votes)){
        //Add brother
        const channel = await guild.channels.cache.get(brothersDataRefresh.channelID);
        await gen.addToChannel(votes[0], channel);
        await gen.SendToChannel(brothersDataRefresh.channelID, "New Brother", userMention(votes[0]) + " was added to the channel!!", client);
        await gen.SendFeedback(guild.id, "New Brother", userMention(votes[0]) + " was added to the brothers channel!!", client);
        await rolesSchema.updateOne({guildID: guild.id, roleName: "brothers"}, {$set: {"specialFunctions.0.canVote": false}}, {options: {upsert: true}});
        return;
    }
    else{
        //
        return;
    }

}

async function createRole([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, 
            roleName: "brothers"},
        {$set: {
            specialFunctions: {
                canVote: true,
                b1Voted: "",
                b2Voted: "",
                b3Voted: "",
            }}}, 
        {options: {upsert: true}});
}