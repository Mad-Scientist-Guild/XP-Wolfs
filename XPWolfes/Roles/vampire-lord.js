const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors, resolveColor } = require("discord.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");
const getters = require("../GeneralApi/Getter.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("vampire-lord")
        .setDescription("vampire lord commands")
        .addSubcommand(subcommand =>
            subcommand.setName('kill')
                .setDescription('Choose a player to kill')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of kill")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('turn')
                .setDescription('Choose a player to turn')
                .addUserOption(option => 
                    option.setName("target")
                        .setDescription("target of turn")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const vampireLord = await getters.GetRole(guild.id, "vampire-lord");
                const isVampireLord = (vampireLord.roleMembers[0] == interaction.user.id);

                if(isVampireLord || admin){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                    switch(options.getSubcommand())
                        {
                            case "kill":
                                await HandleKill(interaction, guild, client, options)
                                return;
                            case "turn":
                                await HandleTurn(interaction, guild, client, options)
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
        eventBus.subscribe('morning', ResolveMorning)
        eventBus.subscribe('checkVampire', CheckVampireDeath)
    }
}


//Resolve Command Functions
async function HandleKill(interaction, guild, client, options){
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: "vampire-lord"});
    const killingPlayer = await getters.GetUser(options.getUser("target").id, guild.id);

    if(!killingPlayer){
        gen.reply(interaction, "this player is not in the game");
        return;
    }

    if(!role){
        gen.reply(interaction, "role not existent");
        return;
    }

    if(role.specialFunctions.length == 0){
        //create
        await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
            {$set: {specialFunctions: [{
                killing: "",
                turning: "",
                turned: "",
                canUse: true
        }]}}, 
        {options: {upsert: true}});
    }

    const roleRefresh = await rolesSchema.findOne({guildID: guild.id, roleName: "vampire-lord"});

    if(!roleRefresh.specialFunctions[0].canUse){
        await gen.reply(interaction, "Can't use your ability right now");
        return;
    }

    if(killingPlayer.dead){
        await gen.reply(interaction, "The person you are trying to kill is already dead")
        return;
    }

    if(roleRefresh.specialFunctions[0].turning != ""){
        await gen.SendToChannel(roleRefresh.channelID, "Change your mind","You are going to kill instead of turning someone", client, Colors.NotQuiteBlack);
        await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
            {$set: {"specialFunctions.0.turning": ""}}, 
        {options: {upsert: true}});
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
        {$set: {"specialFunctions.0.killing": killingPlayer._id}}, 
    {options: {upsert: true}});

    await gen.SendToChannel(roleRefresh.channelID, "Killing", "You are going to kill " + userMention(killingPlayer._id) + " tonight", client, Colors.NotQuiteBlack);
    await gen.noReply(interaction);
    
}
async function HandleTurn(interaction, guild, client, options){
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: "vampire-lord"});
    const killingPlayer = await getters.GetUser(options.getUser("target").id, guild.id);

    if(!role){
        gen.reply(interaction, "role not existent");
        return;
    }

    if(role.specialFunctions.length == 0){
        //create
        await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
            {$set: {specialFunctions: [{
                killing: "",
                turning: "",
                turned: "",
                canUse: true
        }]}}, 
        {options: {upsert: true}});
    }

    const roleRefresh = await rolesSchema.findOne({guildID: guild.id, roleName: "vampire-lord"});

    if(!roleRefresh.specialFunctions[0].canUse){
        await gen.reply(interaction, "Can't use your ability right now");
        return;
    }

    if(killingPlayer.dead){
        await gen.reply(interaction, "The person you are trying to turn is already dead")
        return;
    }

    if(roleRefresh.specialFunctions[0].turned != ""){
        await gen.reply(interaction, "You already turned someone.")
        return;
    }

    if(roleRefresh.specialFunctions[0].killing != ""){
        await gen.SendToChannel(roleRefresh.channelID, "Change your mind", "You are going to turn instead of kill someone tonight", client, Colors.NotQuiteBlack );
        await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
            {$set: {"specialFunctions.0.killing": ""}}, 
        {options: {upsert: true}});
    }

    await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
        {$set: {"specialFunctions.0.turning": killingPlayer._id}}, 
    {options: {upsert: true}});

    await gen.SendToChannel(roleRefresh.channelID, "Turning", "You are going to turn " + userMention(killingPlayer._id) + " tonight", client, Colors.NotQuiteBlack);
    await gen.noReply(interaction);
    
}


//Resolve Timebased Functions
async function ResolveNight([client, game]){

    const role = await rolesSchema.findOne({guildID: game._id, roleName: "vampire-lord"});

    if(!role){
        return;
    }

    if(role.specialFunctions.length == 0){
        //create
        await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
            {$set: {specialFunctions: [{
                killing: "",
                turning: "",
                turned: "",
                canUse: true
        }]}}, 
        {options: {upsert: true}});
        return;
    }

    if(role.specialFunctions[0].killing != ""){
        await gen.SendToChannel(role.channelID, "Kill", "Your target is going to die this morning", client, Colors.NotQuiteBlack);
        await gen.SendFeedback(game._id, "Vampire Kill", "The vampire is killing " + userMention(role.specialFunctions[0].killing) + " tonight");
        await gen.addToNightKilled(role.specialFunctions[0].killing, game._id, client, "vampire-lord");

        await rolesSchema.updateOne({guildID: game._id, roleName: "vampire-lord"}, 
            {$set: {"specialFunctions.0.killing": ""}}, 
        {options: {upsert: true}});

        return;
    }

    if(role.specialFunctions[0].turning != ""){
        await gen.SendToChannel(role.channelID, "Turning", "Your target is going to become a vampire spawn this morning", client, Colors.NotQuiteBlack);
        await gen.SendFeedback(game._id, "Vampire Kill", "The vampire is turning " + userMention(role.specialFunctions[0].killing) + " tonight");

        await rolesSchema.updateOne({guildID: game._id, roleName: "vampire-lord"}, 
            {$set: {"specialFunctions.0.killing": "", "specialFunctions.0.canUse": false}}, 
        {options: {upsert: true}});

        return;
    }

}
async function ResolveMorning([client, game])
{
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "vampire-lord"});

    if(!role){
        return;
    }

    if(role.specialFunctions.length == 0){
        //create
        await rolesSchema.updateOne({guildID: guild.id, roleName: "vampire-lord"}, 
            {$set: {specialFunctions: [{
                killing: "",
                turning: "",
                turned: "",
                canUse: true
        }]}}, 
        {options: {upsert: true}});
        return;
    }

    if(role.specialFunctions[0].turning != "")
    {
        const spawn = await rolesSchema.findOne({guildID: game._id, roleName: "vampire-spawn"});

        if(!spawn){
            await rolesSchema.create({
                guildID: guild.id,
                roleName: "vampire-spawn",
                channelID: role.channelID,
                roleMembers: [],
                specialFunctions: []
            })
        }

        await gen.addToChannel(role.specialFunctions[0].turning, await gen.getChannel(client, role.channelID));
        await gen.SendToChannel(role.channelID, "New Vampire Spawn", userMention(role.specialFunctions[0].turning), " you are now a vampire spawn!");

        await rolesSchema.updateOne({guildID: game._id, roleName: "vampire-spawn"}, 
            {$push: {roleMembers: role.specialFunctions[0].turning}}, 
        {options: {upsert: true}});

        await factionSchema.updateOne({guildID: game._id, factionName: "undead"}, 
            {$push: {factionMembers: role.specialFunctions[0].turning}}, 
        {options: {upsert: true}});

        await factionSchema.updateOne({guildID: guild.id, factionMembers: 
            {$in: [role.specialFunctions[0].turning]}}, 
            {$pull: {factionMembers: role.specialFunctions[0].turning}}, 
            {options: {upsert:true}});

        await rolesSchema.updateOne({guildID: game._id, roleName: "vampire-lord"}, 
            {$set: {"specialFunctions.0.turning": "", 
                "specialFunctions.0.turned": role.specialFunctions[0].turning, 
                "specialFunctions.0.canUse": false}}, 
        {options: {upsert: true}});
        
    }
}
async function ResolveEvening([client, game]){
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "vampire-lord"});

    if(!role){
        return;
    }

    if(role.specialFunctions.length == 0){
        //create
        await rolesSchema.updateOne({guildID: game._id, roleName: "vampire-lord"}, 
            {$set: {specialFunctions: [{
                killing: "",
                turning: "",
                turned: "",
                canUse: true
        }]}}, 
        {options: {upsert: true}});
        return;
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "vampire-lord"}, 
        {$set: {"specialFunctions.0.canUse": true}}, 
    {options: {upsert: true}});
}

async function CheckVampireDeath([UserID, game, client])
{
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "vampire-lord"});

    if(!role){
        return;
    }

    if(!role.roleMembers.includes(UserID))
    {
        return;
    }
    
    if(role.specialFunctions[0].turned != ""){
        await gen.SendToChannel(role.channelID, "Vampire lord died", "The vampire lord has died and " + userMention(role.specialFunctions[0].turned) + " has become the new vampire lord", client, Colors.NotQuiteBlack);
        await gen.SendFeedback(game._id, "Vampire lord died", "The vampire lord has died and " + userMention(role.specialFunctions[0].turned) + " has become the new vampire lord", client, Colors.NotQuiteBlack)

        await rolesSchema.updateOne({guildID: game._id, roleName: "vampire-lord"}, 
            {$push: {roleMembers: role.specialFunctions[0].turned},
            $set: {"specialFunctions.0.turned": ""}}, 
        {options: {upsert: true}});

        await rolesSchema.updateMany({guildID: game._id, roleMembers: {$in: [role.specialFunctions[0].turned]}}, 
            {$pull: {roleMembers: role.specialFunctions[0].turned}}, 
        {options: {upsert: true}});
    }

}
