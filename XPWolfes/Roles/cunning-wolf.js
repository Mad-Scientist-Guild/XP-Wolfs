const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors, resolveColor } = require("discord.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");
const getters = require("../GeneralApi/Getter.js");
const gameData = require("../Schemas/game-data.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("cunning-wolf")
        .setDescription("cunning wolf commands")
        .addSubcommand(subcommand =>
            subcommand.setName('fake-vote')
                .setDescription('Choose to turn the person you are planning on killing')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("fake vote for target")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const role = await getters.GetRole(guild.id, "cunning-wolf");
                const isRole = (role.roleMembers[0] == interaction.user.id);

                if(isRole || admin){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                    switch(options.getSubcommand())
                        {
                            case "fake-vote":
                                await handleCunning(interaction, guild, options)
                                return;
                        }
                }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    },
    async startup(){
        eventBus.subscribe("rolesCreated", createRole);
    }
}

//Resolve Command Functions
async function handleCunning(guild, interaction, options){
    const {client} = interaction
    const cunning = getters.GetRole(guild.id, "cunning-wolf")
    const user = await users.findOne({guildID: guild.id, _id: options.getUser("player").id});
    const game = await gameData.findOne({_id: guild.id});

    if(!game.canVote){
        gen.reply(interaction, "You currently can't vote", true);
        return;
    }

    if(user.dead){
        gen.reply(interaction, "The user you are trying to fake vote for is already dead", true);
        return;
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "cunning-wolf"}, {$set: {"specialFunctions.0.cunningWolfVote": options.getUser("player").id}})

    await gen.SendToChannel(cunning.channelID, 
        "Fake Vote", "You will fake vote for " + userMention(options.getUser("player").id) + " today! \n" +
        "Make sure to real vote with /lynch vote", 
        client);
}


async function createRole([client, game]){
    await rolesSchema.updateOne({guildID: game._id, roleName: "cunning-wolf"}, 
        {$set: {specialFunctions: [{
            cunningWolfVote: "",
    }]}}, 
    {options: {upsert: true}});
}