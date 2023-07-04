const {SlashCommandBuilder, roleMention, StringSelectMenuBuilder} = require("@discordjs/builders");
const serverSchema = require("../Schemas/server-schema");
const mongo = require("../mongo");
const { ActionRowBuilder, SelectMenuBuilder } = require("discord.js");

module.exports = {
    data : new SlashCommandBuilder()
        .setName("remove")
        .setDescription("remove a callout or message")
        .addSubcommand(subcommand =>
            subcommand.setName('message')
                .setDescription('please give the message you want to remove from the list')

        )
        .addSubcommand(subcommand =>
            subcommand.setName('callout')
                .setDescription('please give the callout you want to remove from the list')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('times')
                .setDescription('please give the time you want to remove from the list')
        ),
    async execute(interaction){
        const {member, options, guild} = interaction;
        
        if(!member.permissions.has('ADMINISTRATOR')){
            
            interaction.reply("YOU ARE NOT AN ADMINISTRATOR!!!!");
            return;
        }

        let schemeData
        
        await mongo().then(async mongoose => {
            try{
                schemeData = await serverSchema.findOne({ _id: guild.id });
                if(schemeData)
                {
                    await handleMessage(options, guild, interaction);
                    await handleCallouts(options, guild, interaction);
                    await handleTimes(options, guild, interaction);
                } 
                else{
                    console.log("no data")
                    await interaction.reply({
                        content: `There is no data yet for this server. please first use initialize`,
                        ephemeral: true
                    })
                    return
                }
            } 
            finally{
                mongoose.connection.close();
            }
        })
    }
}

async function handleMessage(options, guild, interaction) {
    if (options.getSubcommand() === 'message') {
        
        data = await serverSchema.findOne({_id: guild.id});
        messages = await data.messages

        const actionRowRomponent = await new ActionRowBuilder().setComponents(
            await new StringSelectMenuBuilder()
                .setCustomId('messages_menu')
                .setPlaceholder('select message')
                .setOptions(
                    messages.map(message => {return {label: message, value: message}})
                    )
        )

        await interaction.reply({
            components: [actionRowRomponent],
            ephemeral: true
        });
    }
    else{
        return;
    }
}

async function handleCallouts(options, guild, interaction) {
    if (options.getSubcommand() === 'callout') {

        data = await serverSchema.findOne({_id: guild.id});
        callouts = await data.callouts

        const actionRowRomponent = await new ActionRowBuilder().setComponents(
            await new StringSelectMenuBuilder()
                .setCustomId('callouts_menu')
                .setPlaceholder('select message')
                .setOptions(
                    callouts.map(callout => {return {label: callout, value: callout}})
                    )
        )

        await interaction.reply({
            components: [actionRowRomponent],
            ephemeral: true
        });
    }
    else{
        return;
    }
}

async function handleTimes(options, guild, interaction) {
    if (options.getSubcommand() === 'times') {

        const data = await serverSchema.findOne({_id: guild.id});
        const times = await data.times

        const actionRowRomponent = await new ActionRowBuilder().setComponents(
            await new StringSelectMenuBuilder()
                .setCustomId('times_menu')
                .setPlaceholder('select time')
                .setOptions(
                    times.map(time => {return {label: time, value: time}})
                    )
        )

        await interaction.reply({
            components: [actionRowRomponent],
            ephemeral: true
        });
    }
    else{
        return;
    }
}