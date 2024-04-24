package br.fecap.informaes;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import com.google.android.material.textfield.TextInputEditText;

import org.w3c.dom.Text;

import java.text.DecimalFormat;

public class Saude extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_saude);






        Button btnLimpar = findViewById(R.id.btn_SaudeLimpar);
        Button btnEncerrar = findViewById(R.id.btn_SaudeEncerrar);
        EditText editAltura = findViewById(R.id.edit_SaudeAltura);
        EditText editPeso = findViewById(R.id.edit_SaudePeso);
        TextView txtAltura = findViewById(R.id.txt_SaudeAltura);
        TextView txtPeso = findViewById(R.id.txt_SaudePeso);
        TextView txtIMC = findViewById(R.id.txt_SaudeIMC);
        TextView txtStatus = findViewById(R.id.txt_SaudeStatus);

        editAltura.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {

            }

            @Override
            public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
                calcularIMC(editAltura, editPeso, txtAltura, txtPeso, txtIMC, txtStatus);
            }

            @Override
            public void afterTextChanged(Editable editable) {

            }
        });

        editPeso.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {

            }

            @Override
            public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {
                calcularIMC(editAltura, editPeso, txtAltura, txtPeso, txtIMC, txtStatus);
            }

            @Override
            public void afterTextChanged(Editable editable) {

            }
        });

        btnLimpar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                editPeso.setText("");
                editAltura.setText("");
            }
        });

        btnEncerrar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                startActivity(new Intent(Saude.this, MainActivity.class));
                finish();
            }
        });

    }

    private void calcularIMC(EditText editAltura, EditText editPeso, TextView txtAltura, TextView txtPeso, TextView txtIMC, TextView txtStatus) {
        String alturaStr = editAltura.getText().toString();
        String pesoStr = editPeso.getText().toString();

        if (!TextUtils.isEmpty(alturaStr) && !TextUtils.isEmpty(pesoStr)) {
            double altura = Double.parseDouble(alturaStr);
            double peso = Double.parseDouble(pesoStr);
            DecimalFormat df = new DecimalFormat("#.##");
            double imc = (peso / (altura * altura))*10000;

            txtAltura.setText("Altura: " + altura + " cm");
            txtPeso.setText("Peso: " + peso + " kg");
            txtIMC.setText("IMC: " + df.format(imc));

            if(imc < 16){
                txtStatus.setText("Magreza severa");
            }
            else if(imc < 17){
                txtStatus.setText("Magreza moderada");
            }
            else if(imc < 18.5){
                txtStatus.setText("Magreza leve");
            }
            else if(imc < 25){
                txtStatus.setText("Peso ideal!");
            }
            else if(imc < 30){
                txtStatus.setText("Acima do peso");
            }
            else if(imc < 35){
                txtStatus.setText("Obesidade nivel 1");
            }
            else if(imc <= 40){
                txtStatus.setText("Obesidade nivel 2");
            }
            else if(imc > 40){
                txtStatus.setText("Obesidade nivel 3");
            }


        } else {
            txtAltura.setText("Altura: -");
            txtPeso.setText("Peso: -");
            txtIMC.setText("IMC: -");
            txtStatus.setText("");
        }
    }

}