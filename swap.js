var from_currency;
var to_currency;

async function set_from_amount(i) {
    var default_account = (await web3.eth.getAccounts())[0];
    var el = $('#from_currency');
    if (el.val() == '')
        $('#from_currency').val(
            Math.floor(
                100 * parseFloat(await underlying_coins[i].methods.balanceOf(default_account).call()) / coin_precisions[i]
            ) / 100
        );
}

async function highlight_input() {
    var default_account = (await web3.eth.getAccounts())[0];
    var el = $('#from_currency');
    var balance = parseFloat(await underlying_coins[from_currency].methods.balanceOf(default_account).call()) / coin_precisions[from_currency];
    if (el.val() > balance)
        el.css('background-color', 'red')
    else
        el.css('background-color', 'blue');
}

async function set_to_amount() {
    var i = from_currency;
    var j = to_currency;
    var b = parseInt(await swap.methods.balances(i).call()) * c_rates[i];
    if (b >= 0.001) {
        // In c-units
        var dx_ = $('#from_currency').val();
        var dx = BigInt(dx_ * coin_precisions[i]).toString();
        var dy_ = parseInt(await swap.methods.get_dy_underlying(i, j, dx).call()) / coin_precisions[j];
        var dy = dy_.toFixed(2);
        $('#to_currency').val(dy);
        $('#exchange-rate').text((dy_ / dx_).toFixed(4));
    }
    else
        $('#from_currency').prop('disabled', true);
    highlight_input();
}

async function from_cur_handler() {
    from_currency = $('input[type=radio][name=from_cur]:checked').val();
    to_currency = $('input[type=radio][name=to_cur]:checked').val();
    var default_account = (await web3.eth.getAccounts())[0];

    if (BigInt(await underlying_coins[from_currency].methods.allowance(default_account, swap_address).call()) > max_allowance / BigInt(2))
        $('#inf-approval').prop('checked', true)
    else
        $('#inf-approval').prop('checked', false);

    await set_from_amount(from_currency);
    if (to_currency == from_currency) {
        if (from_currency == 0) {
            to_currency = 1;
        } else {
            to_currency = 0;
        }
        $("#to_cur_" + to_currency).prop('checked', true);
    }
    await set_to_amount();
}

async function to_cur_handler() {
    from_currency = $('input[type=radio][name=from_cur]:checked').val();
    to_currency = $('input[type=radio][name=to_cur]:checked').val();
    if (to_currency == from_currency) {
        if (to_currency == 0) {
            from_currency = 1;
        } else {
            from_currency = 0;
        }
        $("#from_cur_" + from_currency).prop('checked', true);
        await set_from_amount(from_currency);
    }
    await set_to_amount();
}

async function handle_trade() {
    var default_account = (await web3.eth.getAccounts())[0];
    var i = from_currency;
    var j = to_currency;
    var b = parseInt(await swap.methods.balances(i).call()) / c_rates[i];
    if (b >= 0.001) {
        var dx = Math.floor($('#from_currency').val() * coin_precisions[i]);
        var min_dy = Math.floor($('#to_currency').val() * 0.95 * coin_precisions[j]);
        var deadline = Math.floor((new Date()).getTime() / 1000) + trade_timeout;
        dx = BigInt(dx).toString();
        if ($('#inf-approval').prop('checked'))
            await ensure_underlying_allowance(i, max_allowance)
        else
            await ensure_underlying_allowance(i, dx);
        min_dy = BigInt(min_dy).toString();
        await swap.methods.exchange_underlying(i, j, dx, min_dy, deadline).send({
            'from': default_account,
            'gas': 1200000});
        await update_fee_info();
        from_cur_handler();
    }
}

async function init_ui() {
    $('input[type=radio][name=from_cur]').change(from_cur_handler);
    $('input[type=radio][name=to_cur]').change(to_cur_handler);

    $("#from_cur_0").attr('checked', true);
    $("#to_cur_1").attr('checked', true);

    $('#from_currency').on('input', set_to_amount);
    $('#from_currency').click(function() {this.select()});

    $("#trade").click(handle_trade);

    await update_fee_info();
    from_cur_handler();
    $("#from_currency").on("input", highlight_input);
}

window.addEventListener('load', async () => {
    init_menu();

    const WalletConnectProvider = window.WalletConnectProvider.default
    const providerOptions = {
        walletconnect: {
            package: WalletConnectProvider, // required
            options: {
              infuraId: "c334bb4b45a444979057f0fb8a0c9d1b" // required
            }
        }
    };

    const web3Connect = new Web3Connect.default.Core({
      network: "mainnet", // optional
      cacheProvider: true, // optional
      providerOptions // required
    });

    const provider = await web3Connect.connect();

    provider.on("chainChanged", (chainId) => {
        console.log(chainId, "CHAIN")
        if(chainId != 1) {
            $('#error-window').text('Error: wrong network type. Please switch to mainnet');
            $('#error-window').show();
        }
    });

    provider.on("accountsChanged", (accounts) => {
        console.log(accounts)
        location.reload()
    })

    const web3 = new Web3(provider);

    window.web3 = web3


/*    if (window.ethereum)
    {
        window.web3 = new Web3(ethereum);
        await ethereum.enable();
    }
    else
        window.web3 = new Web3(infura_url);*/
    await init_contracts();
    await init_ui();
});
