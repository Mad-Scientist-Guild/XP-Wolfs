const {SlashCommandBuilder, roleMention, userMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits} = require("discord.js");
const gen = require("../generalfunctions.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');
const getters = require("../GeneralApi/Getter.js");
const gameData = require("../Schemas/game-data.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("peeking-girl")
        .setDescription("vampire lord commands")
        .addSubcommand(subcommand =>
            subcommand.setName('listen_in')
                .setDescription('Choose the time at where you want to start listening. This will be active for 30 minutes')
                .addStringOption(option => 
                    option.setName("start_time")
                        .setDescription("HH:MM")
                        .setRequired(true)
                )
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const role = await getters.GetRole(guild.id, "peeking-girl");
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
                            case "listen_in":
                                await handleListeningTime(interaction, guild, client, options)
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
        eventBus.subscribe('peeking-girl-check', listenIn)
        eventBus.subscribe('morning', handleMorning)
        eventBus.subscribe("rolesCreated", createRole);

    }
}

async function handleListeningTime(interaction, guild, client, options)
{
    const game = await gameData.findOne({_id: guild.id});
    const role = await rolesSchema.findOne({guildID: guild.id, roleName: "peeking-girl"});

    if(!role){
        gen.reply(interaction, "role not existent");
        return;
    }
    if(role.specialFunctions.UsedAbility){
        gen.reply(interaction, "You have already used your ability");
        return;
    }
    
    const startTime = options.getString("start_time")
    
    await rolesSchema.updateOne({guildID: guild.id, roleName: "peeking-girl"}, 
        {$set: {specialFunctions: [{
            UsedAbility: true,
            StartTime: startTime
        }]}}, 
    {options: {upsert: true}});

    await gen.SendToChannel(role.channelID, "Start Time Set", "You will start listening at " + startTime, client);
    await gen.SendFeedback(guild.id, "Peeking girl decided", "The peeking girl will listen in starting at " + startTime, client);
    gen.noReply(interaction);
}

async function listenIn([client, game])
{
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "peeking-girl"});
    const WWRole = await getters.GetRole(game._id, "werewolf");
    const CultistRole = await getters.GetRole(game._id, "cultist");
    if(!WWRole) return;
    const WWChannel = await gen.getChannel(client, WWRole.channelID);
    if(!WWChannel) return;

    await gen.SendToChannel(role.channelID, "Started Listening", "You have started listening in on the werewolfs", client);

    let messages = [];
    WWChannel.awaitMessages({max: 1, time: (60000 * 1), errors: ["time"]})
        .then(async (collection) => {
            messages.push(collection.first());
            await WWChannel.awaitMessages({time: (60000 * 1) , errors: ["time"]})
                .then(async (collection2) => {
                    collection2.forEach(message => {
                        messages.push(message);
                    });
                    let sendMessage = "";

                    await messages.forEach(async message => {

                        if(WWRole.roleMembers.includes(message.author.id)){
                            sendMessage += "**wolf " + (WWRole.roleMembers.indexOf(message.author.id) + 1) + "**: " + message.content + "\n";
                        }
                        if(CultistRole.roleMembers.includes(message.author.id)){
                            sendMessage += "**wolf " + (WWRole.roleMembers.length + 1) + "**: " + message.content + "\n";
                        }
                    });

                    await gen.SendToChannel(role.channelID, "Results", sendMessage, client);
                })
                .catch(async (err) => {
                    let sendMessage = "";

                    if(WWRole.roleMembers.includes(messages[0].author.id)){
                        sendMessage += "**wolf " + (WWRole.roleMembers.indexOf(messages[0].author.id) + 1) + "**: " + messages[0].content + "\n";
                    }
                    if(CultistRole.roleMembers.includes(messages[0].author.id)){
                        sendMessage += "**wolf " + (WWRole.roleMembers.length + 1) + "**: " + messages[0].content + "\n";
                    }

                    await gen.SendToChannel(role.channelID, "Results", sendMessage, client);
                });
    }).catch(async (err) => {
        //console.log(err)
        await gen.SendToChannel(role.channelID, "Results", "It was completely quiet..", client);
    });

    

}

async function handleMorning([client, game]){
    const role = await rolesSchema.findOne({guildID: game._id, roleName: "peeking-girl"});

    if(!role){
        return;
    }
    if(role.specialFunctions.length == 0){
        return;
    }

    await rolesSchema.updateOne({guildID: game._id, roleName: "peeking-girl"}, 
        {$set: {specialFunctions: [{
            UsedAbility: false,
            StartTime: ""
    }]}}, 
    {options: {upsert: true}});
}

async function createRole([client, game]){
    await rolesSchema.updateOne({guildID: game._id, roleName: "peeking-girl"}, 
        {$set: {specialFunctions: [{
            UsedAbility: false,
            StartTime: ""
    }]}}, 
    {options: {upsert: true}});
}



