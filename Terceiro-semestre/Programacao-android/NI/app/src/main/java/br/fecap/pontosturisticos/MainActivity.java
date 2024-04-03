package br.fecap.pontosturisticos;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import android.content.DialogInterface;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.RadioGroup;
import android.widget.SeekBar;
import android.widget.TextView;

public class MainActivity extends AppCompatActivity {

    private ImageView imagem;
    private Button btnProximo, btnConcluir;
    private SeekBar sbSatisfacao;
    private TextView txtFoto, txtSatisfacao;
    private RadioGroup rgGroup;

    private int controleFoto = 3;
    private int controleSeek;
    private String controleRadius;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        imagem = findViewById(R.id.img_Foto);
        btnProximo = findViewById(R.id.btn_proximo);
        btnConcluir = findViewById(R.id.btn_concluir);
        sbSatisfacao = findViewById(R.id.sb_satisfacao);
        txtFoto = findViewById(R.id.txt_tituloFoto);
        txtSatisfacao = findViewById(R.id.txt_satisfacao);
        rgGroup = findViewById(R.id.rg_group);

        rgGroup.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup radioGroup, int i) {
                switch (i) {
                    case R.id.radioButton:
                        controleRadius = "Já fui";
                        break;
                    case R.id.radioButton2:
                        controleRadius = "Penso em ir";
                        break;
                    case R.id.radioButton3:
                        controleRadius = "Ainda não sei";
                        break;
                    case R.id.radioButton4:
                        controleRadius = "Provavelmente não vou";
                        break;
                    case R.id.radioButton5:
                        controleRadius = "Não iria";
                        break;
                }
            }
        });

        sbSatisfacao.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int i, boolean b) {
                txtSatisfacao.setText("Nível de satisfação: " + i);
                controleSeek = i;
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {

            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {

            }
        });

    }

    public void proximaImagem(View view){
        controleFoto++;
        if (controleFoto > 5) {
            controleFoto = 1;
        }

        switch (controleFoto) {
            case 1:
                imagem.setImageResource(R.drawable.becodobatman);
                txtFoto.setText("Beco do Batman");
                break;
            case 2:
                imagem.setImageResource(R.drawable.masp);
                txtFoto.setText("Museu de Arte de São Paulo");
                break;
            case 3:
                imagem.setImageResource(R.drawable.liberdade);
                txtFoto.setText("Bairro Liberdade");
                break;
            case 4:
                imagem.setImageResource(R.drawable.ibirapuera);
                txtFoto.setText("Parque Ibirapuera");
                break;
            case 5:
                imagem.setImageResource(R.drawable.ipiranga);
                txtFoto.setText("Museu do Ipiranga");
                break;
        }
    }

    public void concluir(View view){
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Local: " + txtFoto.getText().toString());
        builder.setMessage("Você escolheu: " + controleRadius + "\nNível de satisfação: " + controleSeek + "\n\nObrigado pela avaliação!");
        builder.setPositiveButton("Ok!", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                dialog.dismiss();
            }
        });

        AlertDialog alertDialog = builder.create();
        alertDialog.show();

    }

}