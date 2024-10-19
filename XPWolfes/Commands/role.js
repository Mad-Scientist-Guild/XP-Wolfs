const {SlashCommandBuilder, roleMention, channelMention} = require("@discordjs/builders");
const rolesSchema = require("../Schemas/roles-schema")
const mongo = require("../mongo");
const { ChannelFlagsBitField, PermissionFlagsBits } = require("discord.js");
const gen = require("../generalfunctions");
const {eventBus} = require("../MISC/EventBus.js");
const factionSchema = require("../Schemas/faction-Schema.js");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("role")
        .setDescription("All commands to do with roles")
        .addSubcommand(subcommand =>
            subcommand.setName('add_user')
                .setDescription('Adds a user to a specific role')
                .addUserOption(option => 
                    option.setName("user")
                        .setDescription("User you want to be added to the role")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("role_name")
                        .setDescription("The role you want to add the user too (Case sensitive). User /role get_all to see all roles")
                        .setRequired(true)
                )
        )//add
        .addSubcommand(subcommand =>
            subcommand.setName('get_all')
                .setDescription('Returns a list of all available existing roles')
        )//get_all
        .addSubcommand(subcommand =>
            subcommand.setName('get')
                .setDescription('Returns the stats of a specific role')
                .addStringOption(option => 
                    option.setName("role_name")
                        .setDescription("Specific role you want to see (Case sensitive). User /role get_all to see all roles")
                        .setRequired(true)
                )
        )//get_specific
        .addSubcommand(subcommand => 
            subcommand.setName('create')
                .setDescription("Please fill in the details for the role")
                .addStringOption(option => 
                    option.setName("role_name")
                        .setDescription("Please give the name of the role you would like to add")
                        .setRequired(true)
                    )
                .addChannelOption(option => 
                    option.setName("channel")
                        .setDescription("Please give the channel where you want the message to be send to")
                        .setRequired(true)
                    )
        )//create
        .addSubcommand(subcommand => 
            subcommand.setName('create_all')
                .setDescription("Please fill in the details for the role")
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
                    option.setName("role_name")
                        .setDescription("The name of the role you would like the user to be removed")
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
                    case "get_all":
                        await handleGetAll(guild, interaction);
                        return;
                    case "get":
                        await handleGet(options, guild, interaction);
                        return;
                    case "create":
                        await handleCreate(options, guild, interaction)
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
                mongoose.connection.close();
            }
        })
    }
}

async function handleAddUser(options, guild, interaction){
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: options.getString('role_name')})

    if(!role){
        gen.reply(interaction, "The role you where trying to add the user to was not found")
    }
    if(role.roleMembers.includes(options.getUser('user').id)){
        gen.reply(interaction, "The user you where trying to add from the role is already part of the role")
    }

    await rolesSchema.updateOne({ guildID: guild.id, roleName: options.getString("role_name") }, 
    { $push: { "roleMembers": options.getUser('user').id } }, 
    { options: { upsert: true } });
    
    if(options.getString("role_name") == "werewolf"){
        await factionSchema.updateOne({ guildID: guild.id, factionName: "werewolfs" }, 
            { $push: { "factionMembers": options.getUser('user').id } }, 
            { options: { upsert: true } })
    }
    else if(options.getString("role_name") == "lich" || options.getString("role_name") == "vampire-lord"){
        await factionSchema.updateOne({ guildID: guild.id, factionName: "undead" }, 
            { $push: { "factionMembers": options.getUser('user').id } }, 
            { options: { upsert: true } })
    }
    else{
        await factionSchema.updateOne({ guildID: guild.id, factionName: "vilagers" }, 
            { $push: { "factionMembers": options.getUser('user').id } }, 
            { options: { upsert: true } })
    }

    gen.reply(interaction, `user ${options.getUser('user').username} has been added to the role ${options.getString("role_name")}`);
} 
    
async function handleGetAll(guild, interaction){
    const allEntries = await rolesSchema.find({guildID: guild.id})
    allRoleNames = "**Roles:** \n";

    
    await allEntries.forEach(entry => {
        allRoleNames = allRoleNames + `${entry.roleName}\n`
    });
        
    gen.reply(interaction, allRoleNames)
}

async function handleGet(options, guild, interaction){
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: options.getString("role_name")})

    if(!role){
        gen.reply(interaction, "Role not found")
        return;
    }

    const string = "**Role Name:** " + role.roleName + "\n" +
    "**Channel:** " + channelMention(role.channelID) + "\n" +
    "**Role Members:** " + role.roleMembers + "\n" +
    "**Special Functions:** " + role.specialFunctions 

    interaction.reply({
        content: string,
        ephemeral: true
    })
} 
            
async function handleCreate(options, guild, interaction){
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: options.getString("role_name")})

    if(role){
        gen.reply(interaction, "This role has already been created");
    }
    else{
        let rolename = options.getString('role_name')
        await rolesSchema.create({
            guildID: guild.id,
            roleName: rolename.toLowerCase(),
            channelID: options.getChannel('channel').id,
            roleMembers: [],
            specialFunctions: []
        })
        gen.reply(interaction, "Role has been created")
    }
} 

async function handleCreateAll(options, guild, interaction){
    const {client} = await interaction;
    const catID = options.getString("category_id")

    const category = await client.channels.cache.get(catID);
    const channels = await Array.from(category.children.cache.values());
    
    for( let channel of channels )
    {
        await rolesSchema.create({
            guildID: guild.id,
            roleName: channel.name.toLowerCase(),
            channelID: channel.id,
            roleMembers: [],
            specialFunctions: []
        })
    }

    gen.reply(interaction, "Role has been created")
    
} 

async function handleRemoveUser(options, guild, interaction){

        const role = await rolesSchema.findOne({guildID: guild.id, roleName: options.getString('role_name')})

        if(!role){
            gen.reply(interaction, "The role you where trying to remove the user from was not found")
            return;
        }
        if(!role.roleMembers.includes(options.getUser('user').id)){
            gen.reply(interaction, "The user you where trying to remove from the role is not part of the role")
            return;
        }

        await rolesSchema.updateOne({ guildID: guild.id, roleName: options.getString("role_name") }, { $pull: { roleMembers: options.getUser('user').id } }, { options: { upsert: true } });
        gen.reply(interaction, `user ${options.getUser('user').username} has been removed from the role ${options.getString("role_name")}`)
}