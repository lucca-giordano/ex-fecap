using Godot;
using System;

public partial class fase1 : Node2D
{
	// Called when the node enters the scene tree for the first time.
	public override void _Ready()
	{
		GD.Print("Passei no Ready!");
	}

	// Called every frame. 'delta' is the elapsed time since the previous frame.
	public override void _Process(double delta)
	{
	}

	private void _on_button_pressed()
	{
		GD.Print("Botao apertado!");
		GetTree().ChangeSceneToFile("res://fase2.tscn");
	}

}
