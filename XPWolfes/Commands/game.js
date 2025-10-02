const {SlashCommandBuilder, roleMention, channelMention, } = require("@discordjs/builders");
const rolesSchema = require("../Schemas/roles-schema")
const users = require("../Schemas/users")
const gamedata = require("../Schemas/game-data")
const mongo = require("../mongo");
const gen = require("../generalfunctions")
const mayor = require("../Schemas/mayor-schema")
const votesSchema = require("../Schemas/vote-schema")
const {PermissionFlagsBits, Colors } = require("discord.js");
const gameData = require("../Schemas/game-data");
const {eventBus} = require('../MISC/EventBus.js');
const factionSchema = require("../Schemas/faction-Schema.js");


module.exports = {
    data : new SlashCommandBuilder()
        .setName("game")
        .setDescription("all comands that have to do with the game")
        .addSubcommand(subcommand =>
            subcommand.setName('join')
                .setDescription('Use when you want to join')
        )
        .addSubcommand(subcommand =>
             subcommand.setName('get_alive_players')
                 .setDescription("Gives a list of all players that are alive in the current game")
             )
        ,
    async execute(interaction){
        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                if(!admin || admin){
                    switch(options.getSubcommand())
                    {
                        case "join":
                            await handleJoin(guild, interaction, client);
                            return;
                        case "get_alive_players":
                            await GetAlivePlayers(guild, interaction)
                            return;
                    }
                }
                else{
                    gen.reply(interaction, "You are not allowed to run this command")
                }
            } 
            finally{
                
            }
        })
    }
}//Done

async function handleJoin(guild, interaction, client)
{
    const user = await users.findOne({_id: interaction.user.id, guildID: guild.id})
    const game = await gamedata.findOne({_id: guild.id});

    if(game && !game.started){
        if(game.alive.length >= 30){
            await gen.reply(interaction, "The game is already full");
            return;
        }

        if(!user){ 
            await users.create({
                _id: interaction.user.id,
                guildID: guild.id,
                dead: false,
                voted: false
            })
            await gen.SendFeedback(guild.id, "PLAYER JOINED!", `${gen.getName(interaction, interaction.user.id)} Joined the game`, client)
            await gen.reply(interaction, "You have joined the game!")
            await rolesSchema.updateOne({guildID: guild.id, roleName: "vilagers"}, {$push: {roleMembers: interaction.user.id}}, {options: {upsert: true}});
        }
        else if(user.dead){
            await users.updateOne({ _id: user }, { $set: { "dead": false } }, { options: { upsert: true } });
            await gen.reply(interaction, "You have joined the game!")
            await rolesSchema.updateOne({guildID: guild.id, roleName: "vilagers"}, {$push: {roleMembers: interaction.user.id}}, {options: {upsert: true}});
        }
        else{
            await gen.reply(interaction, "You are already part of the game!")
        }
    }
    else if(!game){
        await gen.reply(interaction, "There is no game available to join. Please contact your GM for further information")
    } 
    else if(game.started){
        await gen.reply(interaction, "The game has already started, you can not join. Please contact the GM for further information")
    }
}//Done

async function GetAlivePlayers(guild, interaction){
    const {client} = interaction;
    const game = await gamedata.findOne({_id: guild.id});

    if(game){
        if(game.started && !game.finished){
            const alivePlayers = game.alive;
            list = "```Alive players: \n"

            await alivePlayers.forEach(async element => {
                const user = await client.users.cache.get(element);
                if(user){
                    list = list + "- "+ user.tag + "\n";
                }
            });

            list = list + "```"

            gen.reply(interaction, list);
        } else{
            gen.reply(interaction, "The game has not started yet or has already finished")
        }
    }else{
        gen.reply(interaction, "No game was found")
    }   
}//Done
