const {SlashCommandBuilder, roleMention, channelMention, EmbedBuilder, userMention} = require("@discordjs/builders");
const gameData = require("./Schemas/game-data")
const users = require("./Schemas/users")
const rolesSchema = require("./Schemas/roles-schema")
const factionSchema = require("./Schemas/faction-Schema.js");

const mongo = require("./mongo");
const wildboy = require("./Roles/wildboy.js");
const { Colors, GuildApplicationCommandManager, AttachmentBuilder } = require("discord.js");
const mayorSchema = require("./Schemas/mayor-schema");
const { eventBus } = require("./MISC/EventBus.js");
const getters = require("./GeneralApi/Getter.js");

async function reply(interaction, msg, private = true){
    await interaction.reply({
        content: msg,
        ephemeral: private
    })
}

//Reply to command
async function noReply(interaction){
    interaction.deferReply();
    interaction.deleteReply();
}

//Dont reply to command
async function SendAnouncement(interaction = undefined, title, msg, gamedata = undefined, client = undefined){
    let game
    let pGuild;

    if(!gamedata && interaction){
        const {client, guild} = interaction
        pGuild = guild;
        game = await gameData.findOne({_id: guild.id});
    }
    else if(gamedata && !interaction){
        if(client) pGuild = await client.guilds.fetch(gamedata._id)
        game = gamedata
    }
    
    const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle(title)
        .setDescription(msg)
        .setFooter({ text: "Day: " + game.day})

    pGuild.channels.cache.get(game.channels[0].anouncementChannel).send( {embeds: [embed]} )
}

//Send msg specifically in announcement channel
async function SendToChannel(channelID, title, msg, client, color = Colors.Default){

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(msg)

    await client.channels.cache.get(channelID).send( {embeds: [embed]} )
}

async function SendNewspaper(interaction = undefined, NewspaperLink, gamedata = undefined, client = undefined){
    let game
    let pGuild;

    if(!gamedata && interaction){
        const {client, guild} = interaction
        pGuild = guild;
        game = await gameData.findOne({_id: guild.id});
    }
    else if(gamedata && !interaction){
        if(client) pGuild = await client.guilds.fetch(gamedata._id)
        game = gamedata
    }

    const attachment = new AttachmentBuilder(NewspaperLink);

    pGuild.channels.cache.get(game.channels[0].anouncementChannel).send( {files: [attachment]} )
    
}

//Send msg to specific channel
function getName(interaction = null, userID, client = null){
    if(interaction && !client) {client = interaction.client}
    const user = client.users.cache.get(userID).tag;
    
    return user.split("#")[0]
}

//Get the name of a user
function removeFromChannelWriting(userID, channel){
    channel.permissionOverwrites.edit(userID, 
        {
            SendMessages: false,
        })
}

//Removes user from writing in a channel
function addToChannel(userID, channel)
{
    channel.permissionOverwrites.edit(userID, 
    {
        SendMessages: true,
        ViewChannel: true
    })
}

//Adds user to channel
function votedForPreset(interaction, userID, votedOn){
    return "**" + getName(interaction, userID) + "** voted for **" + getName(interaction, votedOn) + "** for mayor"
}

//Preset for the voted on msg
async function addToNightKilled(UserID, GuildID, client, Cause){
    const game = await gameData.findOne({_id: GuildID});

    if(!game){
        console.log("NO GAME FOUND - addToNightKilled")
        return;
    }

    const killedPlayer = users.findOne({_id: UserID})
    if(killedPlayer.isMayor){
        SendFeedback(GuildID, "MAYOR KILL", getName(null, UserID, client) + " Is the current mayor. They are dying tonight so the succesor will be the new mayor", client)
    }

    await gameData.updateOne({_id: GuildID}, {$push: {nightKilled: {id: UserID, cause: Cause}}}, {options: {upsert: true}});
    
    SendFeedback(GuildID, "KILLING", getName(null, UserID, client) + "Is going to die in the morning", client)
}

async function killNightKilled(client, game){

    await gameData.updateOne({_id: game._id}, {$set: {killedLastNight: []}}, {options: {upsert: true}});

    const updatedGame = await gameData.findOne({_id: game._id})

    if(updatedGame.nightKilled.length < 1){
        await SendFeedback(game._id, "NEW DAY, NO DEATH?", "It was awfully quiet tonight, nobody died!", client);
        return;
    }

    let msg = "Killed people: \n"

    updatedGame.nightKilled.forEach(async killedPerson => {
        msg = msg + `${userMention(killedPerson.id)} - killed by ${killedPerson.cause} \n`
        await Kill(killedPerson.id, game._id, client);
    })


    const silverAngel = await rolesSchema.findOne({guildID: game._id, roleName: "silver-angel"})
    if(silverAngel.specialFunctions.length > 0 && silverAngel.specialFunctions[0].protecting != "")
    {
        await rolesSchema.updateOne(
        {guildID: game._id, roleName: "silver-angel"}, 
        {set: {"specialFunctions.0.protecting": "", "specialFunctions.0.protectedLast": silverAngel.specialFunctions[0].protecting}}, 
        {options: {upsert: true}});

        await SendFeedback(game._id, "Protected", userMention(UserID) + " was protected and didnt die", client, Colors.White);
        return;
    }

    await gameData.updateOne({_id: game._id}, {$set: {nightKilled: []}}, {options: {upsert: true}})
    await SendFeedback(game._id, "NEW DAY, NEW DEATH", msg, client);
}

//Kill player right then and there
async function Kill(UserID, GuildID, client, guild = null, Cause = ""){
    //Kill person
    if(client){
        if(guild == null) guild = getGuild(client, GuildID)
            
        const game = await getters.GetGame(GuildID);

        //Silver angel check;
        const silverAngel = await rolesSchema.findOne({guildID: GuildID, roleName: "silver-angel"})
        if(silverAngel.specialFunctions.length > 0 && UserID == silverAngel.specialFunctions[0].protecting)
        {
            await rolesSchema.updateOne(
            {guildID: GuildID, roleName: "silver-angel"}, 
            {$set: {"specialFunctions.0.protecting": "", "specialFunctions.0.protectedLast": silverAngel.specialFunctions[0].protecting}}, 
            {options: {upsert: true}});

            await SendFeedback(GuildID, "Protected", userMention(UserID) + " was protected and didn't die", client, Colors.White);
            return;
        }

        const KilledPlayer = await users.findOne({_id: UserID, guildID: GuildID})

        const KilledPlayerFamily = await getters.GetUsersFamily(GuildID, UserID);

        if(KilledPlayerFamily.familyProtected){
            await SendFeedback(GuildID, "Protected", userMention(UserID) + " was protected and didn't die", client, Colors.White);
            return;
        }
            
        await gameData.updateOne({_id: GuildID}, {$push: {killedLastNight: KilledPlayer._id}}, {options: {upsert: true}});

        if(KilledPlayer.isMayor){
            await SendFeedback(GuildID, "Mayor dead!", "The mayor died, The succesor is taking over", client)
            let mayordata = await mayorSchema.findOne({_id: GuildID})
            await mayorSchema.updateOne({_id: GuildID}, {$set: {mayor: mayordata.successor, successor: ""}})
        }
        
        //Handle mayor's succesor death
        const mayor = await mayorSchema.findOne({_id: GuildID})
        if(mayor){
            if(mayor.successor == UserID){
                await SendFeedback(GuildID, "SUCCESSOR DIED!", "The mayors successor died, a new one has to be chosen", client, Colors.Red)
                await mayorSchema.updateOne({_id: GuildID}, {$set: {successor: ""}}, {upsert: true})
            }
        }
    
        await eventBus.deploy('checkLover', [UserID, game, client]);
        await eventBus.deploy('checkVampire', [UserID, game, client]);
    }
    
    await users.updateOne({_id: UserID, guildID: GuildID}, {$set: {dead: true, isMayor: false, votedOn: "", votedOnMayor: ""}}, {options: {upsert: true}});
    await gameData.updateOne({_id: GuildID}, {$pull: {alive: UserID}}, {options: {upsert: true}})
    await SendFeedback(GuildID, "PLAYER DIED!", getName(null, UserID, client) + " Died", client, Colors.Red)
    const game = await gameData.findOne({_id: GuildID});


    //Remove from all channels exept dead
    const channels = await guild.channels.cache
    for (const channel of channels.values()) 
    {
        removeFromChannelWriting(UserID, channel)
    }
    
    const deadChannel = await guild.channels.cache.get(game.channels[0].deadChannel)
    addToChannel(UserID, deadChannel)
}

async function Revive(UserID, guild, client){

    const channels = await guild.channels.cache
    for (const channel of channels.values()) 
    {
        channel.permissionOverwrites.edit(UserID, 
            {
                SendMessages: true,
            })
        }
        
    const game = await gameData.findOne({_id: guild.id})
    await users.updateOne({_id: UserID, guildID: guild.id}, {$set: {dead: false}}, {options: {upsert: true}});
    await gameData.updateOne({_id: guild.id}, {$push: {alive: UserID}}, {options: {upsert: true}})
    const deadChannel = await guild.channels.cache.get(game.channels[0].deadChannel)
    deadChannel.permissionOverwrites.edit(UserID, 
        {
            SendMessages: false,
            ViewChannel: false
        })

    await SendFeedback(guild.id, "REVIVED", getName(null, UserID, client) + " was revived by a GM", client, Colors.Green)
}

//Kills a player
async function SendFeedback(guildID, title, msg, client, color = Colors.Default){
    const game = await gameData.findOne({_id: guildID});  

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(msg)
        .setFooter({ text: "Day: " + game.day})
    
    await client.channels.cache.get(game.channels[0].modChannel).send( {embeds: [embed]} )
}
//Sends feedback to the feedback channel;
function getGuild(client, guildID){
    return client.guilds.cache.get(guildID)
}

function getChannel(client, channelID){
    return client.channels.fetch(channelID);
}
//Gets the guild from a client

async function LeftHouse(userID, guildID){
    await gameData.updateOne({_id: guildID}, {$push: {leftHouse: userID}}, {upsert: true});
}

async function CheckLeftHouse(userID, guildID){
    let left = await gameData.findOne({_id: guildID}, {$elemMatch: {leftHouse: userID}}, {upsert: true})

    if(left){
        return true;
    }
    else{
        return false;
    }
}

async function ClearLeftHouse(){
    await gameData.updateOne({_id: guildID}, {$set: {leftHouse: []}}, {upsert: true});
}

async function GetPlayersFaction(userID, GuildID){
    const faction = await factionSchema.findOne({guildID: GuildID, factionMembers: {$in: [userID]}});

    if(faction){
        return faction.factionName
    }
    else{
        return undefined;
    }
}

module.exports = {
    addToNightKilled, 
    SendAnouncement, 
    reply, 
    SendToChannel, 
    getName, 
    addToChannel, 
    votedForPreset, 
    Kill, 
    Revive,
    SendFeedback, 
    noReply, 
    removeFromChannelWriting, 
    getGuild,
    getChannel,
    SendNewspaper,
    LeftHouse,
    CheckLeftHouse,
    killNightKilled,
    GetPlayersFaction
}