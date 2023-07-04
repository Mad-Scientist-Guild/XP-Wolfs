const {SlashCommandBuilder, roleMention, EmbedBuilder, channelMention } = require("@discordjs/builders");
const mongo = require("../mongo");
const { MessageEmbed, AttachmentBuilder, PermissionFlagsBits, Colors } = require('discord.js');
const cupidSchema = require("../Schemas/cupid-schema");
const gen = require("../generalfunctions.js")

module.exports = {
    data : new SlashCommandBuilder()
        .setName("cupid")
        .setDescription("return the current time")
        .addSubcommand(subcommand => 
            subcommand.setName("link")
                .setDescription("Choose 2 players you want to link")
                .addUserOption(option => 
                    option.setName("lover1")
                        .setDescription("Player 1 you want to link")
                        .setRequired(true)
                )
                .addUserOption(option => 
                    option.setName("lover2")
                        .setDescription("Player 2 you want to link")
                        .setRequired(true)
                ))
        .addSubcommand(subcommand => 
            subcommand.setName("set")
                .setDescription("Select the player you want to be cupid")
                .addUserOption(option => 
                    option.setName("cupid")
                        .setDescription("Player 1 you want to link")
                        .setRequired(true)
                )
                .addChannelOption(option => 
                    option.setName("cupid-chat")
                        .setDescription("Cupid's channel")
                        .setRequired(true)
                )
                .addChannelOption(option => 
                    option.setName("lovers-chat")
                        .setDescription("Lovers channel")
                        .setRequired(true)
                )
                
        ),
    async execute(interaction){
        const {member, options, guild} = interaction;
        
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                let cupid
                const cuSchema = await cupidSchema.findOne({_id: guild.id});
                if(cuSchema) { cupid = await cuSchema.cupid == interaction.user.id}
                if(admin){
                    switch(options.getSubcommand())
                    {
                        case "set":
                            await handleSet(options, guild, interaction);
                            return;
                    }
                }
                if(cupid || admin){
                    switch(options.getSubcommand())
                    {
                        case "link":
                            await handleLink(options, guild, interaction);
                            return;
                    }
                }
                else{
                    gen.reply(interaction, "You do not have permission to use this command");
                }
            }
            finally{
                mongoose.connection.close();
            }
        })
    }
}

async function handleSet(options, guild, interaction){
     const cupidData = await cupidSchema.findOne({_id: guild.id});
     const cupidID = options.getUser("cupid").id
     const cupidChatID = options.getChannel("cupid-chat").id
     const loversChatID = options.getChannel("lovers-chat").id
     
     if(cupidData){
        //update data that already exists
        await cupidSchema.updateOne({_id: guild.id}, 
            {$set: 
                {
                    cupid: cupidID,
                    lovers: [],
                    loversDead: false,
                    cupidChannel: cupidChatID,
                    loversChannel: loversChatID
                }
            },
            {options: {upsert: true}}
        )

    }
    else{
        //Make new entry
        await cupidSchema.create({
            _id: guild.id,
            cupid: cupidID,
            lovers: [],
            loversDead: false,
            cupidChannel: cupidChatID,
            loversChannel: loversChatID
        })
    }

    const cupidChannel = await guild.channels.cache.get(cupidChatID);
    cupidChannel.permissionOverwrites.edit(cupidID, 
    {
            SendMessages: true,
            ViewChannel: true
    })
    
    gen.reply(interaction, "cupid set")
}
    
async function handleLink(options, guild, interaction){
    const {client} = interaction

    const cupidData = await cupidSchema.findOne({_id: guild.id});
    const lover1 = options.getUser("lover1").id
    const lover2 = options.getUser("lover2").id
    
    if(cupidData){
        const cupid = cupidData.cupid;
        const loversChat = cupidData.loversChannel;

        //Check if not self
        if(cupid == lover1 || cupid == lover2){
            gen.reply(interaction, "You cannot choose yourself to link with someone");
            return;
        }
        //Check if already set
        if(cupidData.lovers.length > 0){
            gen.reply(interaction, "You have already chosen two lovers");
            return;
        }

        await cupidSchema.updateOne({_id: guild.id}, {$set: {lovers: [lover1, lover2]}}, {options: {upsert: true}});

        //Add lovers to lovers chat
        const loversChannel = await guild.channels.cache.get(loversChat);
        gen.addToChannel(lover1, loversChannel);
        gen.addToChannel(lover2, loversChannel);

        gen.SendToChannel(cupidData.cupidChannel, "You have successfully linked " + gen.getName(interaction, lover1) + " and " + gen.getName(interaction, lover2), client);
        gen.SendToChannel(cupidData.loversChannel, gen.getName(interaction, lover1) + " and " + gen.getName(interaction, lover2) + ", You are the lovers!", client);
        await gen.SendFeedback(guild.id, "CUPID LINKED", "Cupid linked " + gen.getName(interaction, lover1) +" and " + gen.getName(interaction, lover2) + " as lovers", client, Colors.LuminousVividPink);
        gen.noReply(interaction)    
    }
    else{
        gen.reply(interaction, "Please first setup the cupid role with /cupid set")
    }

}