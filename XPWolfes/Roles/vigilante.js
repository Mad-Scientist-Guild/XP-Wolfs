const {SlashCommandBuilder, roleMention, EmbedBuilder, channelMention, userMention } = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { MessageEmbed, AttachmentBuilder, PermissionFlagsBits, Colors } = require('discord.js');
const gen = require("../generalfunctions.js")
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const getters = require("../GeneralApi/Getter.js");
const factionSchema = require("../Schemas/faction-Schema.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("vigilante")
        .setDescription("vigilante abilities")
        .addSubcommand(subcommand =>
            subcommand.setName('shoot')
                .setDescription('choose a player to shoot.')
                .addUserOption(option => 
                    option.setName("player")
                        .setDescription("player to protect")
                        .setRequired(true)
                )
        ),
    async execute(interaction){
        const {member, options, guild} = interaction;
        
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            const vigilante = await rolesSchema.findOne({guildID: guild.id, roleName: "vigilante"});
            const isVigilante = vigilante.roleMembers.includes(interaction.user.id)
 
            try{
                if(admin || isVigilante){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                    switch(options.getSubcommand())
                    {
                        case "shoot":
                            await handleShoot(options, guild, interaction);
                            return;
                    }
                }
                else{
                    gen.reply(interaction, "You cant use this command");
                }  
            }
            finally{
                mongoose.connection.close();
            }
        })  
    },
    async startup(){
        eventBus.subscribe(onEvening, "evening");
        eventBus.subscribe(onNight, "night");
    }
}

async function handleShoot(options, guild, interaction){
    const {client} = interaction;

    const vigilante = await rolesSchema.findOne({guildID: guild.id, roleName: "vigilante"});
    const shotPlayer = await getters.GetUser(options.getUser("player").id, guild.id);

    if(!vigilante){
        gen.reply(interaction, "role not existent");
        return;
    }

    if(vigilante.specialFunctions.length == 0){
        //create
        await rolesSchema.updateOne({guildID: guild.id, roleName: "vigilante"}, 
            {$set: {specialFunctions: [{
                shooting: "",
                canUse: true
        }]}}, 
        {options: {upsert: true}});
    }

    const vigilanteRefresh = await rolesSchema.findOne({guildID: guild.id, roleName: "vigilante"});

    if(!vigilanteRefresh.specialFunctions[0].canUse){
        gen.reply(interaction, "Can't use your ability at this time");
        return;
    }

    if(shotPlayer.dead){
        gen.reply(interaction, "You cant protect someone who is dead");
        return;
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "vigilante"}, 
        {$set: 
        {"specialFunctions.0.shooting": options.getUser("player").id}}, 
        {options: {upsert: true}});
    
    await gen.SendFeedback(guild.id, "vigilante shooting", "The vigilante is shooting " + userMention(options.getUser("player").id), client, Colors.Green)
    await gen.SendToChannel(vigilanteRefresh.channelID, "Shooting", "You chose to shoot " + userMention(options.getUser("player").id), client, Colors.Green);
    await gen.noReply(interaction);
}

async function onEvening([client, game]){
    await rolesSchema.updateOne({guildID: game._id, roleName: "vigilante"}, 
        {$set: 
        {"specialFunctions.0.canUse": true}}, 
        {options: {upsert: true}});
}

async function onNight([client, game]){
    const vigilante = await rolesSchema.findOne({guildID: game._id, roleName: "vigilante"});
    const vilagers = await factionSchema.findOne({guildID: game._id, factionName: "vilagers"});

    if(vigilante.specialFunctions.length > 0 && vigilante.specialFunctions[0].shooting != ""){
        await gen.addToNightKilled(vigilante.specialFunctions[0].shooting, game._id, client, "Shot by vigilante");

        if(vilagers.factionMembers.includes(vigilante.specialFunctions[0].shooting)){
            await gen.addToNightKilled(vigilante.roleMembers[0], game._id, client, "Shot by vigilante");
        }
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "vigilante"}, 
        {$set: 
        {"specialFunctions.0.canUse": false, "specialFunctions.0.shooting": ""}}, 
        {options: {upsert: true}});

}