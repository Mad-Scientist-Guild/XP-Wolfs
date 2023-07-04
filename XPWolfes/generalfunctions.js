const {SlashCommandBuilder, roleMention, channelMention, EmbedBuilder} = require("@discordjs/builders");
const gameData = require("./Schemas/game-data")
const users = require("./Schemas/users")
const rolesSchema = require("./Schemas/roles-schema")
const mongo = require("./mongo");
const wildboy = require("./Commands/wildboy.js");
const { Colors, GuildApplicationCommandManager } = require("discord.js");

async function reply(interaction, msg, pvt = true){
    await interaction.reply({
        content: msg,
        ephemeral: pvt
    })
}

async function noReply(interaction){
    interaction.deferReply();
    interaction.deleteReply();
}

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

    pGuild.channels.cache.get(game.anouncementChannel).send( {embeds: [embed]} )
}
async function SendToChannel(channelID, msg, client){
    await client.channels.cache.get(channelID).send( msg )
}
function getName(interaction = null, userID, client = null){
    if(interaction) {client = interaction.client}
    const user = client.users.cache.get(userID).tag;
    
    return user.split("#")[0]
}

function removeFromChannelWriting(userID, channel){
    channel.permissionOverwrites.edit(userID, 
        {
            SendMessages: false,
        })
}

function addToChannel(userID, channel){
    channel.permissionOverwrites.edit(userID, 
    {
        SendMessages: true,
        ViewChannel: true
    })
}
function votedForPreset(interaction, userID, votedOn){
    return "**" + getName(interaction, userID) + "** voted for **" + getName(interaction, votedOn) + "**"
}

async function addToNightKilled(UserID, GuildID, client, Cause){
    const game = await gameData.findOne({_id: GuildID});

    if(!game){
        console.log("NO GAME FOUND - addToNightKilled")
        return;
    }

    await gameData.updateOne({_id: GuildID}, {$push: {nightKilled: {id: UserID, cause: Cause}}}, {options: {upsert: true}});
    SendFeedback(GuildID, "KILLING", getName(null, UserID, client) + "Is going to die in the morning", client)
}

async function Kill(UserID, GuildID, client, guild = null){
    //Kill person
    if(client){
        if(guild == null) guild = getGuild(client, GuildID)
        //Handle mayor death
        const KilledPlayer = await users.findOne({_id: UserID, guildID: GuildID})
        if(KilledPlayer.isMayor){
            await SendFeedback(GuildID, "Mayor dead!", "The mayor died, a new mayor needs to be chosen", client)
        }
        
        //Handle wildboy
        const wildboyRole = await rolesSchema.findOne({guildID: GuildID, roleName: "wildboy"})
        if(wildboyRole.specialFunctions[0]){
            if(wildboyRole.specialFunctions[0].mentor == UserID){
                await wildboy.mentorDies(GuildID, client)
            }
        }
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
    
    const deadChannel = await guild.channels.cache.get(game.deadChannel)
    addToChannel(UserID, deadChannel)
}

async function SendFeedback(guildID, title, msg, client, color = Colors.Default){
    const game = await gameData.findOne({_id: guildID});  

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(msg)
        .setFooter({ text: "Day: " + game.day})

    await client.channels.cache.get(game.modChannel).send( {embeds: [embed]} )
}

function getGuild(client, guildID){
    return client.guilds.cache.get(guildID)
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
    SendFeedback, 
    noReply, 
    removeFromChannelWriting, 
    getGuild
}