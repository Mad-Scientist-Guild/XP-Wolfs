const {SlashCommandBuilder, roleMention, channelMention} = require("@discordjs/builders");
const mongo = require("../mongo");
const { ChannelFlagsBitField, PermissionFlagsBits } = require("discord.js");
const gen = require("../generalfunctions");
const getters = require("../GeneralApi/Getter.js");
const familySchema = require("../Schemas/family-schema.js");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("family")
        .setDescription("All commands to do with families")
        .addSubcommand(subcommand =>
            subcommand.setName('add_user')
                .setDescription('Adds a user to a specific family')
                .addUserOption(option => 
                    option.setName("user")
                        .setDescription("User you want to be added to the role")
                        .setRequired(true)
                )
                .addChannelOption(option => 
                    option.setName("family_channel")
                        .setDescription("The role you want to add the user too (Case sensitive). User /role get_all to see all roles")
                        .setRequired(true)
                )
        )//add_user
        .addSubcommand(subcommand =>
            subcommand.setName('get')
                .setDescription('Returns the stats of a specific family')
                .addChannelOption(option => 
                    option.setName("family_channel")
                        .setDescription("Get info about specific family based on channel")
                        .setRequired(true)
                )
        )//get_specific
        .addSubcommand(subcommand => 
            subcommand.setName('create_all')
                .setDescription("Please fill in the details for the family")
                .addStringOption(option => 
                    option.setName("category_id")
                        .setDescription("please give the category of whitch you want the channels to be used")
                        .setRequired(true)
                    )
        )//create all
        .addSubcommand(subcommand => 
            subcommand.setName('remove_user')
                .setDescription("remove a role")
                .addUserOption(option => 
                    option.setName("user")
                        .setDescription("User you want to be removed from the role")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("channel")
                        .setDescription("The channel of the family")
                        .setRequired(true)
                    )
        )//remove
        ,
    async execute(interaction){

        const {member, options, guild} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        if(!admin){
            
            interaction.reply("YOU ARE NOT AN ADMINISTRATOR!!!!");
            return;
        }
        
        await mongo().then(async mongoose => {
            try{
                switch(options.getSubcommand())
                {
                    case "add_user":
                        await handleAddUser(options, guild, interaction,);
                        return;
                    case "get":
                        await handleGet(options, guild, interaction);
                        return;
                    case "create_all":
                        await handleCreateAll(options, guild, interaction)
                        return;
                    case "remove_user":
                        await handleRemoveUser(options, guild, interaction);
                        return;
                }  
            } 
            finally{
                //mongoose.connection.close();
            }
        })
    }
}

async function handleAddUser(options, guild, interaction){
    const family = await familySchema.findOne({guildID: guild.id, familyChannel: options.getChannel('family_channel').id})

    if(!family){
        gen.reply(interaction, "The family you where trying to add the user to was not found")
        return;
    }
    if(family.familyMembers.includes(options.getUser('user').id)){
        gen.reply(interaction, "The user you where trying to add from the role is already part of the role")
        return;
    }

    await familySchema.updateOne({ guildID: guild.id, familyChannel: options.getChannel('family_channel').id }, 
    { $push: { "familyMembers": options.getUser('user').id } }, 
    { options: { upsert: true } });
    
    gen.reply(interaction, `user ${options.getUser('user').username} has been added to the a family`);
} 

async function handleGet(options, guild, interaction){
    const family = await familySchema.findOne({guildID: guild.id, familyChannel: options.getChannel('family_channel').id})

    if(!family){
        gen.reply(interaction, "Role not found")
        return;
    }

    const string = "**Channel:** " + channelMention(family.familyChannel) + "\n" +
    "**Role Members:** " + family.familyMembers + "\n"

    gen.reply(interaction, string);
} 
            
async function handleCreateAll(options, guild, interaction){
    const {client} = await interaction;
    const catID = options.getString("category_id")

    const category = await client.channels.cache.get(catID);
    const channels = await Array.from(category.children.cache.values());
    
    for( let channel of channels )
    {
        await familySchema.create({
            guildID: guild.id,
            familyName: channel.name,
            familyChannel: channel.id,
            familyMembers: [],
            familyProtected: false
        })
    }

    gen.reply(interaction, "Created families")
    
} 

async function handleRemoveUser(options, guild, interaction){

    const family = await familySchema.findOne({guildID: guild.id, familyChannel: options.getChannel('family_channel').id})

    if(!family){
        gen.reply(interaction, "The role you where trying to remove the user from was not found")
        return;
    }
    if(!family.familyMembers.includes(options.getUser('user').id)){
        gen.reply(interaction, "The user you where trying to remove from the role is not part of the role")
        return;
    }

    await familySchema.updateOne({ guildID: guild.id, familyChannel: options.getChannel('family_channel').id }, { $pull: { familyMembers: options.getUser('user').id } }, { options: { upsert: true } });
    gen.reply(interaction, `user ${options.getUser('user').username} has been removed from the role ${options.getString("role_name")}`)
}