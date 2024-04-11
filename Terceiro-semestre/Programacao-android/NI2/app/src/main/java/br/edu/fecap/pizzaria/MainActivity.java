package br.edu.fecap.pizzaria;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import android.content.DialogInterface;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.textfield.TextInputLayout;

public class MainActivity extends AppCompatActivity {

    private ImageView imagem;
    private TextView nome, seekQtd;
    private SeekBar seekBar;
    private TextInputLayout endereco, observacoes;
    private int numPedido = 1830;
    private int controleSabor = 1;
    private int qtdPizza;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        imagem = findViewById(R.id.img_Sabor);
        nome = findViewById(R.id.txt_Nome);
        seekQtd = findViewById(R.id.txt_Seek);
        seekBar = findViewById(R.id.seekBar);
        endereco = findViewById(R.id.input_Adr);
        observacoes = findViewById(R.id.input_Obs);

        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                seekQtd.setText("Quantidade de pizzas: " + progress);
                qtdPizza = progress;
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {

            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {

            }
        });

    }

    public void concluir(View view){
        AlertDialog.Builder builder =  new AlertDialog.Builder(this);
        builder.setTitle("Pedido realizado com sucesso!");
        builder.setMessage("Numero do pedido: " + numPedido +
                "\nSabor: " + nome.getText().toString() +
                "\nQuantidade: " + qtdPizza +
                "\nEndereço: " + endereco.getEditText().getText().toString() +
                "\nObservações: " + observacoes.getEditText().getText().toString());
        numPedido += 1;
        builder.setPositiveButton("Ok!", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.dismiss();
            }
        });
        AlertDialog alertDialog = builder.create();
        alertDialog.show();
    }

    public void proximoSabor(View view){
        controleSabor++;
        if(controleSabor > 3){
            controleSabor = 1;
        }

        switch (controleSabor){
            case 1:
                nome.setText("Pizza Tradicional");
                imagem.setImageResource(R.drawable.tradicional);
                break;
            case 2:
                nome.setText("Pizza Napoletana");
                imagem.setImageResource(R.drawable.napoletana);
                break;
            case 3:
                nome.setText("Pizza Margherita");
                imagem.setImageResource(R.drawable.margherita);
        }

        Toast.makeText(this, "Sabor alterado: " + nome.getText(), Toast.LENGTH_SHORT).show();
        
    }

}