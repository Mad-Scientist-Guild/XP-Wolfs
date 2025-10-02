const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors, resolveColor } = require("discord.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");
const getters = require("../GeneralApi/Getter.js");
const gameData = require("../Schemas/game-data.js");

const RoleName = "bloodhound"

module.exports = {
    data : new SlashCommandBuilder()
        .setName("bloodhound")
        .setDescription("ancient wolf commands")
        .addSubcommand(subcommand =>
            subcommand.setName('stalk')
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
                const role = await getters.GetRole(guild.id, "bloodhound");
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
                            case "stalk":
                                await handleBloodHound(options, guild, interaction)
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
        eventBus.subscribe('night', ResolveNight)
        eventBus.subscribe('evening', ResolveEvening)
        eventBus.subscribe('morning', bloodhoundInformation)
        eventBus.subscribe("rolesCreated", createRole);

    }
}


//Resolve Command Functions
async function handleBloodHound(options, guild, interaction){
    const {client} = interaction
    const user = await users.findOne({guildID: guild.id, _id: options.getUser("player").id});
    const bloodhound = getters.GetRole(guild.id, "bloodhound")

    if(!bloodhound.canUse){
        gen.reply(interaction, "Can't use at this time");
        return
    }

    if(user.dead){
        gen.reply(interaction, "The user you are trying to check is already dead");
        return;
    }


    await rolesSchema.updateOne({guildID: guild.id, roleName: "bloodhound"}, {$set: {"specialFunctions.0.bloodhoundChecking": options.getUser("player").id}})
    await gen.SendToChannel(bloodhound.specialFunctions[0].bloodhoundChannel, "Stalking", "You will be looking at " + userMention(options.getUser("player").id) + " tonight");
}

//Resolve Timebased Functions
async function ResolveEvening([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, roleName: RoleName}, 
        {$set: {"specialFunctions.0.canUse": true}},
        {options: {upsert: true}}
    )
}


async function ResolveNight([client, game]){
    await rolesSchema.updateOne(
        {guildID: game._id, roleName: "bloodhound"}, 
        {$set: {"specialFunctions.0.canUse": false}},
        {options: {upsert: true}}
    )

    const role = await getters.GetRole(game._id, "bloodhound")
    const rolePlayer = await getters.GetUser(role.roleMembers[0], game._id);

    if(rolePlayer && rolePlayer.blocked){
        if(role.specialFunctions[0].bloodhoundChecking != ""){
            await rolesSchema.updateOne(
                {guildID: game._id, roleName: "bloodhound"},
                {$set: {"specialFunctions.0.bloodhoundChecking": ""}},
                {upsert: true}
            )
        }
    }
}

async function bloodhoundInformation([client, game])
{
    const wwData = await rolesSchema.findOne({guildID: game._id, roleName: "werewolf"})
    const bloodhound = await getters.GetRole(game._id, "bloodhound")


    if(!bloodhound || bloodhound.specialFunctions.length == 0){
        return;
    }

    if(bloodhound.specialFunctions[0].bloodhoundChecking != "" && bloodhound.specialFunctions[0].bloodhoundChecking)
    {
        //Send feedback to mods
        await gen.SendFeedback(game._id, "Bloodhound Check", "Bloodhound checked " + userMention(bloodhound.specialFunctions[0].bloodhoundChecking) + "!", client)
        
        if(game.LeftHouse.includes(bloodhound.specialFunctions[0].bloodhoundChecking)) {
            await gen.SendToChannel(bloodhound.channelID, "They left!", userMention(bloodhound.specialFunctions[0].bloodhoundChecking) + " Left their house this night", client, Colors.Red);
        }
        else {
            await gen.SendToChannel(bloodhound.channelID, "They did not leave!", userMention(bloodhound.specialFunctions[0].bloodhoundChecking) + " did not leave their house this night", client, Colors.Red);
        }

        //Add cub to werewolfs
        await rolesSchema.updateOne({guildID: game._id, roleName: "bloodhound"}, {$set: {"specialFunctions.0.bloodhoundChecking": ""}}, {upsert: true});

        return;
    }
}

async function createRole([client, game]){
    await rolesSchema.updateOne({guildID: game._id, roleName: RoleName}, 
        {$set: {specialFunctions: [{
            canUse: false,
            bloodhoundChecking: "",
    }]}}, 
    {options: {upsert: true}});
}