const {SlashCommandBuilder, roleMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors, resolveColor } = require("discord.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");
const getters = require("../GeneralApi/Getter.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("fox")
        .setDescription("fox commands")
        .addSubcommand(subcommand =>
            subcommand.setName('check_people')
                .setDescription('Choose 2 players to force abstain')
                .addUserOption(option => 
                    option.setName("target-one")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
                .addUserOption(option => 
                    option.setName("target-two")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
                .addUserOption(option => 
                    option.setName("target-three")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const fox = await getters.GetRole(guild.id, "fox");
                const isFox = (fox.roleMembers[0] == interaction.user.id);

                if(isFox || admin){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                    switch(options.getSubcommand())
                        {
                            case "check_people":
                                await HandleCheck(interaction, guild, client, options)
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
        eventBus.subscribe('morning', ResolveCheck)
        eventBus.subscribe('evening', ResolveEvening)
        eventBus.subscribe('night', ResolveNight)
        eventBus.subscribe("rolesCreated", createRole);

    }
}

async function HandleCheck(interaction, guild, client, options){
    
    const foxData = await rolesSchema.findOne({guildID: guild.id, roleName: "fox"});
    
    if(!foxData.canCheck){
        gen.reply(interaction, "You can't check people at this time.");
        return;
    }
    if(!foxData.hasAbility){
        gen.reply(interaction, "Your ability seems to have disappeared.");
        return;
    }

    await rolesSchema.updateOne(
        {guildID: guild.id, roleName: "fox"}, 
        {$set: {"specialFunctions.0.checking": [
            options.getUser("target-one").id, 
            options.getUser("target-two").id,
            options.getUser("target-three").id],
            "specialFunctions.0.isChecking": true    
        }}, 
            {options: {upsert: true}}
        );

    await gen.SendToChannel(foxData.channelID, "Checking", "You are going to check " + userMention(options.getUser("target-one").id) + ", " + userMention(options.getUser("target-two").id) + " and " + userMention(options.getUser("target-three").id) + " tonight", client, Colors.Red);
    await gen.SendFeedback(guild.id, "The Fox", "The fox is going to check " + userMention(options.getUser("target-one").id) + ", " + userMention(options.getUser("target-two").id) + " and " + userMention(options.getUser("target-three").id) + " tonight")
    await gen.noReply(interaction);
}

async function ResolveCheck([client, game])
{
    const vilagers = await factionSchema.findOne({guildID: game._id, factionName: "vilagers"});
    const fox = await rolesSchema.findOne({guildID: game._id, roleName: "fox"});

    if(!fox || fox.specialFunctions.length == 0){
        return;
    }

    const toCheck = await fox.specialFunctions[0].checking

    if(!fox.specialFunctions[0].isChecking){
        return;
    }

    if(vilagers.factionMembers.includes(toCheck[0]) && vilagers.factionMembers.includes(toCheck[1]) && vilagers.factionMembers.includes(toCheck[2]))
    {
        //Guessed wrong
        await rolesSchema.updateOne({guildID: game._id, roleName: "fox"}, 
            {$set: {"specialFunctions.0.canCheck": false, "specialFunctions.0.isChecking": false, "specialFunctions.0.hasAbility": false}}, 
            {options: {upsert: true}});

        await gen.SendToChannel(fox.channelID, "All vilagers", "All of the people you checked are vilagers... You feel your power fade away");

        return;
    }
    else{
        await rolesSchema.updateOne({guildID: game._id, roleName: "fox"}, 
            {$set: {"specialFunctions.0.canCheck": false, "specialFunctions.0.isChecking": false, "specialFunctions.0.checking": []}}, 
            {options: {upsert: true}});

        await gen.SendToChannel(fox.channelID, "Imposter", "One or more of the people you checked is not a vilager");
        return;
    }

}

async function ResolveEvening([client, game]){
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "fox"});

    if(!role){
        return;
    }

    if(role.specialFunctions.length == 0){
        return;
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "fox"}, 
        {$set: {"specialFunctions.0.canCheck": true}}, 
    {options: {upsert: true}});
}
async function ResolveNight([client, game]){
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "fox"});

    if(!role){
        return;
    }

    if(role.specialFunctions.length == 0){
        return;
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "fox"}, 
        {$set: {"specialFunctions.0.canCheck": false}}, 
    {options: {upsert: true}});

    const rolePlayer = await getters.GetUser(role.roleMembers[0], game._id);

    if(rolePlayer && rolePlayer.blocked){
        if(role.specialFunctions[0].isChecking){
            await rolesSchema.updateOne(
                {guildID: game._id, roleName: "fox"},
                {$set: {"specialFunctions.0.isChecking": false, checking: []}},
                {upsert: true}
            )
        }
    }
}


async function createRole([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, 
            roleName: "fox"},
        {$set: {
            specialFunctions:{
                canCheck: false,
                isChecking: false,
                checking: [],
                hasAbility: true
            }}}, 
        {options: {upsert: true}});
}


