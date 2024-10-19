const {SlashCommandBuilder, roleMention} = require("@discordjs/builders");
const mongo = require("../mongo.js");
const { PermissionFlagsBits, Colors } = require("discord.js");
const gen = require("../generalfunctions.js");
const gameData = require("../Schemas/game-data.js");
const roleData = require("../Schemas/roles-schema.js")
const users = require("../Schemas/users.js");
const voteData = require("../Schemas/vote-schema.js");
const rolesSchema = require("../Schemas/roles-schema.js");
const {eventBus} = require('../MISC/EventBus.js');


module.exports = {
    data : new SlashCommandBuilder()
        .setName("pacifist")
        .setDescription("update a specific value")
        .addSubcommand(subcommand =>
            subcommand.setName('cancel_lynch')
                .setDescription('Choose 2 players to force abstain')
        )
,
    async execute(interaction){

        const {member, options, guild, client} = interaction;
        const admin = member.permissions.has(PermissionFlagsBits.Administrator)
        
        await mongo().then(async mongoose => {
            try{
                const pacifist = await getters.GetRole(guild.id, "pacifist");
                const isPacifist = (pacifist.roleMembers[0] == interaction.user.id);

                if(isPacifist || admin){
                    if(!admin){
                        const player = await getters.GetUser(interaction.user.id, guild.id);
                        if(player.dead){
                            gen.reply(interaction, "Can't use this command if you are dead");
                            return;
                        }
                    }
                switch(options.getSubcommand())
                    {
                        case "cancel_lynch":
                            await HandleCancelLynch(interaction, guild, client, options)
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
        
    }
}

async function HandleCancelLynch(interaction, guild, client, options){

    //Check if game is active
    const game = await gameData.findOne({_id: guild.id})
    if(!game){
        await gen.reply(interaction, "There is no game.")
        return;
    }

    //Check if can vote
    if(!game.canVote){
        await gen.reply(interaction, "You are not able to vote yet")
        return;
    }
    
    //Check if command user is pacifist
    const role = await roleData.findOne({guildID: guild.id, roleName: "pacifist"});
    if(!role) {
        await console.log(interaction, "The pacifist role does not exist.");
        return;
    }
    if(!role.roleMembers.includes(interaction.user.id)) {
        await gen.reply(interaction, "You are not the pacifist and cannot use this command")
        return;
    }

    //set targets in database
    await rolesSchema.updateOne(
        {guildID: guild.id, roleName: "pacifist"}, 
        {$set: 
            {
                specialFunctions: [{usingAbility: true}]
            }
        },
        {upsert: true}
    )

    await gen.SendFeedback(guild.id, "PACIFIST ACTION", `The pacifics is canceling the vote today`, client, Colors.Blue)
    await gen.SendToChannel(role.channelID, "PEACE BY FORCE", `You have chosen to stop the lynch today, The town will be notified when the lynch happens`, client, Colors.Green)
    await gen.noReply(interaction);
}
