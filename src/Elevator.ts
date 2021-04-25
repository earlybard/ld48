import {AnimatedSpriteController, AnimationEnd, Component, Entity, Log, System, Timer} from "lagom-engine";
import {Layers, sprites} from "./LD48";
import {getNodeName, HellGraph} from "./graph/Graph";

enum ElevatorStates
{
    Closed,
    Open
}

export class Elevator extends Entity
{
    constructor(readonly startLevel: number, readonly endLevel: number, readonly shaft: number, readonly reverseStart = false)
    {
        super("elevator", 100 + 150 * shaft, (reverseStart ? endLevel : startLevel) * 70 + 50, Layers.ELEVATOR);
    }

    onAdded()
    {
        super.onAdded();

        this.addComponent(new ElevatorComp(this.startLevel, this.endLevel, this.shaft));

        this.addComponent(new SwapDoorState());

        if (this.reverseStart)
        {
            this.addComponent(new ElevatorDestination(this.endLevel, "DOWN"));
        }
        else
        {
            this.addComponent(new ElevatorDestination(this.startLevel, "UP"));
        }

        this.addComponent(new AnimatedSpriteController(ElevatorStates.Open, [
            {
                id: ElevatorStates.Closed, config: {animationEndAction: AnimationEnd.STOP, animationSpeed: 80},
                textures: sprites.textures([[1, 2], [0, 2], [4, 1]])
            },
            {
                id: ElevatorStates.Open, config: {animationEndAction: AnimationEnd.STOP, animationSpeed: 80},
                textures: sprites.textures([[4, 1], [0, 2], [1, 2]])
            }
        ]));
    }
}

export class ElevatorDestination extends Component
{
    constructor(public destinationLevel: number, public direction: "UP" | "DOWN")
    {
        super();
    }
}

export class StoppedElevator extends Component
{
    public node: string;

    public constructor(level: number, shaft: number)
    {
        super();
        this.node = getNodeName("ELEVATOR", level, shaft)
    }

}

export class ElevatorFalling extends Component
{
}

export class ElevatorDropper extends System
{
    types = () => [ElevatorFalling];

    update(delta: number): void
    {
        this.runOnEntities((entity: Entity) =>
        {
            entity.transform.position.y += 160 * (delta / 1000)
        });
    }

}

export class ElevatorDestroyer extends System
{
    update(delta: number): void
    {
        this.runOnEntities((entity: Entity) =>
        {
            if (entity.transform.position.y > 400)
            {
                const elevator = entity.getComponent<ElevatorComp>(ElevatorComp)!;
                const graph = this.getScene().getEntityWithName<HellGraph>("HellGraph")
                graph!.destroyElevator(elevator.startLevel, elevator.endLevel, elevator.shaft)
                entity.destroy();
            }
        });
    }

    types = () => [ElevatorFalling];
}

export class ElevatorMover extends System
{
    types = () => [ElevatorDestination, ElevatorComp];

    update(delta: number): void
    {
        this.runOnEntities((entity: Entity, destination: ElevatorDestination, elevator: ElevatorComp) =>
        {
            // Check if we are there.
            const destY = destination.destinationLevel * 70 + 50;
            const distanceToGoal = destY - entity.transform.y
            let moveDist = Math.min(70 * (delta / 1000), Math.abs(distanceToGoal));
            moveDist *= Math.sign(distanceToGoal);

            entity.transform.y += moveDist;

            // We made it.
            if (moveDist === distanceToGoal)
            {
                entity.addComponent(new StoppedElevator(destination.destinationLevel, elevator.shaft))
                destination.destroy();

                // TODO make this able to handle stops
                let dest: ElevatorDestination;
                if (elevator.endLevel == destination.destinationLevel)
                {
                    dest = new ElevatorDestination(elevator.startLevel, "UP")
                } else
                {
                    dest = new ElevatorDestination(elevator.endLevel, "DOWN")
                }

                entity.addComponent(new SwapDoorState());
                const timer = entity.addComponent(new Timer(2000, dest, false));
                timer.onTrigger.register((caller: Timer<ElevatorDestination>, data: ElevatorDestination) =>
                {
                    entity.addComponent(new SwapDoorState());
                    const restartTimer = entity.addComponent(new Timer(500, data, false));
                    restartTimer.onTrigger.register((caller1, data1) =>
                    {
                        caller.parent.addComponent(data1);

                        const stoppedInfo = caller.parent.getComponent<StoppedElevator>(StoppedElevator)
                        if (stoppedInfo === null) return;
                        caller.parent.removeComponent(stoppedInfo, true)
                    });
                });
            }
        });
    }
}

export class ElevatorComp extends Component
{
    constructor(readonly startLevel: number, readonly endLevel: number, readonly shaft: number)
    {
        super();
    }
}

export class SwapDoorState extends Component
{
}

export class DoorStateSystem extends System
{
    types = () => [AnimatedSpriteController, SwapDoorState, ElevatorComp];

    update(delta: number): void
    {
        this.runOnEntities((entity: Entity, sprite: AnimatedSpriteController, swapState: SwapDoorState) =>
        {
            swapState.destroy();
            const nextState = sprite.currentState == 0 ? 1 : 0;
            sprite.setAnimation(nextState);
        });
    }
}