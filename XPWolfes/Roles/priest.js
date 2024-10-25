const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors, resolveColor } = require("discord.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");
const getters = require("../GeneralApi/Getter.js");
const setters = require("../GeneralApi/Setters.js");

const gameData = require("../Schemas/game-data.js");
const familySchema = require("../Schemas/family-schema.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("priest")
        .setDescription("priest commands")
        .addSubcommand(subcommand =>
            subcommand.setName('protect_family')
                .setDescription('Protect a family')
                .addChannelOption(option => 
                    option.setName("family_channel")
                        .setDescription("Protect a specific family this night.")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const role = await getters.GetRole(guild.id, "priest");
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
                            case "protect_family":
                                await protectFamily(options, interaction, guild, client);
                                return;
                        }
                }
            } 
            finally{
                //mongoose.connection.close();
            }
        })
    },
    async startup(){
        eventBus.subscribe('afternoon', ResolveAfternoon)
        eventBus.subscribe('evening', ResolveEvening)
        eventBus.subscribe("rolesCreated", createRole);
    }
}


//Resolve Command Functions
async function protectFamily(options, interaction, guild, client){
    const role = await getters.GetRole(guild.id, "priest");

    if(role.specialFunctions[0].canUse){
        gen.reply(interaction, "you can't protect anymore, you have already used all your uses");
        return;
    }

    //Check if used 2 or more times
    if(role.specialFunctions[0].protectedAmount >= 2){
        gen.reply(interaction, "you can't protect anymore, you have already used all your uses");
        return;
    }

    //Check if canceling
    if(role.specialFunctions[0].protecting)
    {
        //Cancel protection on family
        await familySchema.updateOne({guildID: guild.id, familyProtected: true}, {$set: {familyProtected: false}}, {options: {upsert: true}});

        gen.reply(interaction, "Canceled your protection previous use")
    }

    const family = await getters.GetFamily(guild.id, options.getChannel("family_channel").id)

    await rolesSchema.updateOne({guildID: guild.id, roleName: "priest"}, {$set: {"specialFunctions.0.protecting": false}}, {options: {upsert: true}});
    await familySchema.updateOne({guildID: guild.id, familyChannel: options.getChannel("family_channel").id}, {$set: {familyProtected: true}}, {options: {upsert: true}});

    gen.SendToChannel(role.channelID, "Protecting", "You are going to protect " + family.familyName, client);
}
async function ResolveAfternoon([client, game]){
 
    await familySchema.updateOne(
        {guildID: guild.id, familyProtected: true}, 
        {$set: {familyProtected: false}}, 
        {options: {upsert: true}});


    await rolesSchema.updateOne(
        {guildID: game._id, roleName: "priest"}, 
        {$set: {"specialFunctions.0.canUse": true}},
        {options: {upsert: true}}
    )
}
async function ResolveEvening([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, roleName: "priest"}, 
        {$set: {"specialFunctions.0.canUse": false}},
        {options: {upsert: true}}
    )
}


async function createRole([client, game]){

    await rolesSchema.updateOne({guildID: game._id, roleName: "priest"}, 
        {$set: {specialFunctions: [{
            protecting: false,
            protectedAmount: 0,
            canUse: true
    }]}}, 
    {options: {upsert: true}});
}