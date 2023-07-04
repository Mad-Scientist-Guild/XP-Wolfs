const {SlashCommandBuilder, roleMention} = require("@discordjs/builders");
const mongo = require("../mongo");
const { EmbedBuilder } = require("discord.js");

module.exports = {
    data : new SlashCommandBuilder()
        .setName('rules')
        .setDescription("Get all rules of the game")
        ,
    async execute(interaction)
    {
        interaction.reply({
            content:
            "**General rules** \n"+
            "- Use of video’s, photos, memes, stickers and gifs is encouraged.\n"+
            "- This document explains how the game works. Read this carefully before you start the game, the game is very different from how it is played in real life.\n"+
            "- A special discord server has been created with different channels to have conversations and discussions.\n"+
            "- If you are late with reporting an action, you may no longer be able to take that action (you can always try though, the game masters might still have time)\n"+
            "- If there are any questions, you can ask the game master(s) anything anytime.\n"+
            "- If you are inactive for more than 48 hours (without warning us) it is possible for you to get eliminated automatically.\n"+
            "- Everyone gets a personal chatroom with the gamemasters to communicate with them, ask questions, use your powers, and/or vote people out.\n"+
            "- You are allowed to say or claim ANYTHING regarding the game (also roles).\n"+
            "- At any time you can ping the gamemaster(s) for clarification or validation\n"+
            "- Screenshots from private chats are also forbidden to be send to other players.\n\n\n"+

            "**Play etiquette** \n"+
            "We've put together a few rules to keep the game fun, exciting, and interesting, no matter your role or faction. Please try to adhere to these, if anyone cheats it could ruin the game for everyone:\n"+
            "-All conversations about the game must be held in the specified discord server. Other conversations/groups of and about the game may NOT be held.\n"+
            "-Sending screenshots of conversations other than the general conversation channel is prohibited. Especially (private) contact with the organizers\n"+
            "-It is possible that the gamemaster(s) finds out that a role is incredibly unbalanced, in which case the rules of this role may be (slightly) adjusted.\n"+
            "-Don’t be an assh*le (general XP code of conduct rules apply)", 
            ephemeral: true
        })
    }

}