const {SlashCommandBuilder, roleMention} = require("@discordjs/builders");
const roleSchema = require("../Schemas/roles-schema");
const mongo = require("../mongo");
const { PermissionFlagsBits } = require("discord.js");
const gen  = require("../generalfunctions");
const users = require("../Schemas/users");
const rolesSchema = require("../Schemas/roles-schema");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("wildboy")
        .setDescription("All commands to do with the wildboy role")
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Choose who will be the wildboy')
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("Player you want to vote for")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('mentor')
                .setDescription('Choose a mentor. If they die, you become a werewolf')
                .addUserOption(option => 
                    option.setName("mentor")
                        .setDescription("Your mentor")
                        .setRequired(true)
                )
        ) 
        ,
    async execute(interaction){
        const {member, options, guild, client} = interaction;
        const wildboy = await roleSchema.findOne({guildID: guild.id, roleName: "wildboy"});

        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        const isWildboy = wildboy.roleMembers.includes(interaction.user.id)

        await mongo().then(async mongoose => {
            try{
                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "set":
                            await handleSet(options, guild, interaction);
                            return;
                    }
                }
                if(admin || isWildboy){
                    switch(options.getSubcommand())
                    {
                        case "mentor":
                            await handleMentor(options, guild, interaction);
                            return;
                    }
                }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    },

    mentorDies
    
}

async function handleSet(options, guild, interaction) {
    const wildboy = await roleSchema.findOne({guildID: guild.id, roleName: "wildboy"});
    const user = await users.findOne({_id: options.getUser("player").id, guildID: guild.id});

    if(!wildboy){
        gen.reply(interaction, "You first have to make the Wild Boy role with **/role create**");
        return;
    }
    if(!user){
        gen.reply(interaction, "This user is not participating in the game yet. Make sure they have done **/game join**");
        return;
    }

    await roleSchema.updateOne({guildID: guild.id, roleName: "wildboy"}, {$set: {roleMembers: [user._id], specialFunctions: [{mentor: ""}]}});
    gen.reply(interaction, "you have added " + gen.getName(interaction, user._id) + " to the wildboy role.");
    const channel = await guild.channels.cache.get(wildboy.channelID);
    gen.addToChannel(user._id, channel);

    
}

async function handleMentor(options, guild, interaction){
    const wildboy = await roleSchema.findOne({guildID: guild.id, roleName: "wildboy"});
    const mentor = await users.findOne({_id: options.getUser("mentor").id, guildID: guild.id});

    if(!wildboy){
        console.log("no wildboy")
        gen.reply(interaction, "You first have to make the Wild Boy role with **/role create**");
        return;
    }
    if(interaction.channel.id != wildboy.channelID){
        gen.reply(interaction, "You are not in the correct channel");
        return;
    }
    if(wildboy.specialFunctions[0].mentor != ""){
        gen.reply(interaction, "You have already set a mentor");
        return;
    }
    if(!mentor){
        gen.reply(interaction, "The person you are trying to assing as mentor is not in this game, please choose someone who is playing.");
        return;
    }
    if(mentor.dead){
        gen.reply(interaction, "The person you are trying to assing as mentor is already dead, please choose someone that is not dead.");
        return;
    }

    await roleSchema.updateOne({guildID: guild.id, roleName: "wildboy", "specialFunctions.mentor": ""}, {$set: {"specialFunctions.$.mentor": mentor._id }});
    gen.reply(interaction, "set mentor", false)
}

async function mentorDies(GuildID, client){
    const werewolf = await roleSchema.findOne({guildID: GuildID, roleName: "werewolf"});
    const wildboy = await roleSchema.findOne({guildID: GuildID, roleName: "wildboy"});

    if(!werewolf) {
        return;
    }
    if(!wildboy){
        return;
    }
    const wildboyPlayer = await users.findOne({_id: wildboy.roleMembers[0], guildID: GuildID});
    if(wildboyPlayer.dead){
        return;
    }

    //Add to werewolfs
    await rolesSchema.updateOne({guildID: GuildID, roleName: "werewolf"}, {$push: {roleMembers: wildboyPlayer._id}})

    //Feedback
    await client.channels.cache.get(wildboy.channelID).send( "Your mentor died, You are now a werewolf" )
    const werewolfChannel = await guild.channels.cache.get(werewolf.channelID);
    werewolfChannel.permissionOverwrites.edit(wildboyPlayer._id, 
        {
            SendMessages: true,
            ViewChannel: true
        })
    await client.channels.cache.get(werewolf.channelID).send( "The mentor of the Wild Boy died, He is now a werewolf" )

}