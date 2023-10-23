const rolesSchema = require("../Schemas/roles-schema");
const mongo = require("../mongo");
const gameData = require("../Schemas/game-data")
const voteData = require("../Schemas/vote-schema")
const users = require("../Schemas/users")
const gen = require("../generalfunctions.js");
const wildboy = require("../Commands/wildboy.js");
const werewolf = require("../Commands/werewolf.js");
const wwSchema = require("../Schemas/ww-schema");
const cupidSchema = require("../Schemas/cupid-schema")
const { userMention, Colors } = require("discord.js");
const imageSchema = require("../Schemas/image-schema");

module.exports = {
    async execute(client){
        await mongo().then(async mongoose => {
            try{
                const currentDate = new Date();
                hours  = currentDate.getHours();
                minutes = currentDate.getMinutes();

                const lynchStartTimes = await gameData.find({lynchTimeStart: `${hours}:${minutes}`, started: true, finished: false})
                const lynchEndTimes = await gameData.find({lynchTimeEnd: `${hours}:${minutes}`, started: true, finished: false})
                const wwRoleStart = await wwSchema.find({starttime: `${hours}:${minutes}`})
                const wwRoleEnd = await wwSchema.find({endtime: `${hours}:${minutes}`})

                const mornings = await gameData.find({morning: `${hours}:${minutes}`, started: true, finished: false})

                //Handle start time of voting
                if(lynchStartTimes.length > 0){
                    await startLoop(client, lynchStartTimes)
                }

                //Handle end time of voting
                if(lynchEndTimes.length > 0){
                    await endLoop(client, lynchEndTimes)
                }

                if(wwRoleStart.length > 0){
                    await wwStartLoop(client, wwRoleStart)
                }

                //Handle end time of voting
                if(wwRoleEnd.length > 0){
                    await wwEndLoop(client, wwRoleEnd)
                }

                if(mornings.length > 0){ 
                    if(mornings.length > 0){
                        await morningLoop(client, mornings)
                    }
                }
            }
            finally{

            }
    })
}
}

async function startLoop(client, lynchStartTimes){
    lynchStartTimes.forEach(async element => {
        await handleVoteStart(client, element)
    });
}

async function handleVoteStart(client, entry){
    if(entry.started && !entry.finished){
        await gameData.updateOne({_id: entry._id}, {$set: {canVote: true}}, {options: {upsert: true}});
        gen.SendAnouncement(undefined, "VOTE STARTED","**You can now vote to lynch someone!**", entry, client)
    } 
}

async function endLoop(client, lynchEndTimes){
    lynchEndTimes.forEach(async element => {
        await handleVoteEnd(client, element)
    });
}

async function handleVoteEnd(client, game){
    //Make voting no longer possible
    await gameData.updateOne({_id: game._id}, {$set: {canVote: false}}, {options: {upsert: true}});

    //check who didnt vote and add to abstained
    const didntVote = await users.find({guildID: game._id, voted: false, dead: false});
    const absExists = await voteData.findOne({guildID: game._id, _id: "Abstained"})
    if(!absExists){
        await voteData.create({
            _id: "Abstained",
            guildID: game._id,
            votedBy: []
        })
    }
    
    await handleAddToAbstained(didntVote, game)

    //Handle Pacifist Ability
    await HandlePacifistAbility(game)

    const votedata = await voteData.find({guildID: game._id})
    //get and sort the data of voting
    const sorted = await votedata.sort((a, b) => {
        if (a.votedBy.length < b.votedBy.length) {
          return 1;
        }
        if (a.votedBy.length > b.votedBy.length) {
          return -1;
        }
        return 0;
      });

    const alivePlayers = await users.find({guildID: game._id, "dead": false});
    //Check if most people vote for abstained
    if(sorted[0]._id == "Abstained" && sorted[0].votedBy.length >= Math.floor(alivePlayers.length / 2)){
        gen.SendAnouncement(undefined, "Voting has concluded", `Most people voted to Abstain`, game, client)
    }
    //if not, check most votes
    else {
        var sameSize = []

        sorted.forEach(async person => {
            if(person._id == "Abstained"){}
            else if(person.votedBy.length == sorted[0].votedBy.length){
                sameSize.push(person);
            }
        })

        if(sameSize.length == 1){
            gen.SendAnouncement(undefined, "Voting has concluded", `Most people voted to lynch ${userMention(sameSize[0]._id)} with ${sameSize[0].votedBy.length} votes`, game, client)
            gen.Kill(sameSize[0]._id, game._id, client, gen.getGuild(client, game._id))
        } 
        else{
            //check for mayor
            var personToKill = undefined;
            const mayor = await users.findOne({guildID: game._id, isMayor: true})
            if(mayor){
                sameSize.forEach(async person =>{
                    if(person.votedBy.includes(mayor._id)){
                        personToKill = person;
                    }
                })
            }

            if(personToKill != undefined){
                gen.SendAnouncement(undefined, "Voting has concluded", `There was a TIE, but the Mayor has voted to lynch ${userMention(personToKill._id)}`, game, client)
                gen.Kill(personToKill._id, game._id, client)
            }
            else{ gen.SendAnouncement(undefined, "Voting has concluded", `There is a **TIE**. No-one gets lynched`, game, client) }
        }
    }

    //Reset vote data
    await voteData.deleteMany({guildID: game._id})
    await users.updateMany({guildID: game._id, voted: true}, {$set: {votedOn: "", voted: false}}, {options: {upsert: true}})
}

async function handleAddToAbstained(didntVote, game){
    await didntVote.forEach(async player => {
        await voteData.updateOne({_id: "Abstained", guildID: game._id}, {$push: {votedBy: player._id}}, {options: {upsert: true}})
    })
}

async function HandlePacifistAbility(game){
    //Get pacifist
    const pacifist = await rolesSchema.findOne({guildID: game._id, roleName: "pacifist"});

    if(!pacifist){
        console.log("no pacifist, skipping HandlePacifistAbility")
        return;
    }
    if(!pacifist.specialFunctions[0]){
        console.log("No targets chosen")
        return;
    }

    //Get id's to be switched to abstained
    const pacifistPlayer = await users.findOne({_id: pacifist.roleMembers[0], guildID: game._id})
    const targetOne = await users.findOne({_id: pacifist.specialFunctions[0].targetOne, guildID: game._id});
    const targetTwo = await users.findOne({_id: pacifist.specialFunctions[0].targetTwo, guildID: game._id});

    if(!targetOne || !targetTwo){
        console.log("no targets for pacifist, skipping HandlePacifistAbility")
        return;
    }

    //Check if already in abstained and add if need be
    const abstained = await voteData.findOne({guildID: game._id, _id: "Abstained"})
    if(!abstained.votedBy.includes(targetOne._id)){
        await voteData.updateOne({votedBy: {$in: [targetOne._id]}, guildID: game._id}, {$pull: {votedBy: targetOne._id}})
        await voteData.updateOne({_id: "Abstained", guildID: game._id}, {$push: {votedBy: targetOne._id}}, {options: {upsert: true}})
    }
    if(!abstained.votedBy.includes(targetTwo._id)){
        await voteData.updateOne({votedBy: {$in: [targetTwo._id]}, guildID: game._id}, {$pull: {votedBy: targetTwo._id}})
        await voteData.updateOne({_id: "Abstained", guildID: game._id}, {$push: {votedBy: targetTwo._id}}, {options: {upsert: true}})   
    }
    if(!abstained.votedBy.includes(pacifistPlayer._id)){
        await voteData.updateOne({votedBy: {$in: [pacifistPlayer._id]}, guildID: game._id}, {$pull: {votedBy: pacifistPlayer._id}})
        await voteData.updateOne({_id: "Abstained", guildID: game._id}, {$push: {votedBy: pacifistPlayer._id}}, {options: {upsert: true}})
    }

    //Reset pacifist
    rolesSchema.updateOne(
        {guildID: game._id, roleName: "pacifist", "specialFunctions.targetOne": targetOne._id, "specialFunctions.targetTwo": targetTwo._id }, 
        {$set: 
            {
                "specialFunctions.$.targetOne": "",
                "specialFunctions.$.targetTwo": "",
            }
        },
        {upsert: true}
    )
}

async function wwStartLoop(client, wwData){
    wwData.forEach(async element => {
        console.log("handling ww startloop")
        const game = await gameData.findOne({_id: element._id});

        if(!game || !game.started || game.finished){
            console.log(game)
            return;
        }

        await handleWWStartNight(client, element)
    });
}

async function handleWWStartNight(client, wwData){
    await wwSchema.updateOne({_id: wwData._id}, {$set: {canVote: true, votes: [], "members.$[].votedOn": ""}})
    gen.SendToChannel(wwData.channel, "DINNER TIME!", "You can now vote to eat someone! You have untill **" + wwData.endtime + "** to vote with **/werewolf kill_vote**", client, Colors.Red);
}

async function wwEndLoop(client, wwData){
    wwData.forEach(async element => {
        const game = await gameData.findOne({_id: element._id});

        if(!game || !game.started || game.finished){
            return;
        }

        await handleWWEndNight(client, element)
    });
}
``
async function handleWWEndNight(client, wwData){
    werewolf.CheckKill(client, wwData);
}

async function morningLoop(client, games){
    games.forEach(async game => {
        await handleMorning(client, game)
    });
}

async function handleMorning(client, game){
    await gameData.updateMany({started: true, finished: false}, {$inc: {day: 1}}, {options: {upsert: true}})
    
    //Send day inc feedback
    gen.SendFeedback(game._id, "New Day", game.day + 1 + " has started", client);
    
    //Check for lovers death
    await checkLovers(client, game)

    //Kill everyone that needs to be killed
    await killNightKilled(client, game)

    await SendNewspaper(client, game)
}

async function checkLovers(client, game){
    const cupid = await cupidSchema.findOne({_id: game._id});
    if(!cupid || cupid.lovers.length < 1){
        console.log("no lovers or cupid")
        return;
    }
    if(cupid.loversDead){
        return;
    }
    //Check lovers
    const l1 = await users.findOne({guildID: game._id, _id: cupid.lovers[0]})
    const l2 = await users.findOne({guildID: game._id, _id: cupid.lovers[1]})
    
    if(!l1 || !l2){
        console.log("no lover user info found")
        return;
    }
    
    if(l1.dead || game.nightKilled.includes(l1._id)){
        await gen.addToNightKilled(l1._id, game._id, client, "Supuku because their lover died")
        gen.SendFeedback(game._id, "LOVER DIED", "The second lover has commited sudoku", client, Colors.Red);
        await cupidSchema.updateOne({_id: game._id}, {$set: {loversDead: true}}, {options: {upsert: true}});
    }
    if(l2.dead || game.nightKilled.includes(l2._id)){
        await gen.addToNightKilled(l1._id, game._id, client, "Supuku because their lover died")
        gen.SendFeedback(game._id, "LOVER DIED", "The second lover has commited sudoku", client, Colors.Red);
        await cupidSchema.updateOne({_id: game._id}, {$set: {loversDead: true}}, {options: {upsert: true}})
    }
}

async function killNightKilled(client, game){
    const updatedGame = await gameData.findOne({_id: game._id})

    if(!updatedGame.nightKilled){
        console.log("Game does not exist")
        return;
    }

    if(updatedGame.nightKilled.length < 1){
        await gen.SendFeedback(game._id, "NEW DAY, NO DEATH?", "It was awfully quiet tonight, nobody died! \n No one died", client);
        return;
    }

    let msg = "Killed people: \n"

    updatedGame.nightKilled.forEach(async killedPerson => {
        msg = msg + `${userMention(killedPerson.id)} - killed by ${killedPerson.cause} \n`
        await gen.Kill(killedPerson.id, game._id, client);
    })

    await gameData.updateOne({_id: game._id}, {$set: {nightKilled: []}}, {options: {upsert: true}})
    await gen.SendFeedback(game._id, "NEW DAY, NEW DEATH", msg, client);
}

async function SendNewspaper(client, game){
    const schema = await imageSchema.findOne({_id: game._id});

    if(!schema){
        console.log("No image for newspaper");
        return;
    }

    if(schema.imageURL != ""){
        await gen.SendNewspaper(null, schema.imageURL, game, client);
        await imageSchema.updateOne({ _id: game._id }, { $set: { "imageURL": "" } }, { options: { upsert: true } });
    }
}